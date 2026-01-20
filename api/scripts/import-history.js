/**
 * Import action history with mappings built from existing database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const DATA_DIR = join(__dirname, '..', 'data', 'import');

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]);
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    data.push(row);
  }
  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try standard parsing
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

async function main() {
  console.log('Building service ID mappings from database...');

  // Get all services from database with their job site info
  const { data: services, error: svcError } = await supabase
    .from('recurring_services')
    .select('id, service_type, job_site_id, job_site:job_sites(name)');

  if (svcError) {
    console.error('Failed to fetch services:', svcError);
    return;
  }

  // Read the original services CSV to get old Service IDs
  const servicesCSV = readFileSync(join(DATA_DIR, 'recurring-services.csv'), 'utf-8');
  const servicesData = parseCSV(servicesCSV);

  // Build mapping: old Service ID -> new UUID
  // Match by job site name + service type
  const serviceMap = new Map();

  for (const csvRow of servicesData) {
    const oldId = csvRow['Service ID'] || '';
    const jobSiteName = (csvRow['Job Site Name'] || '').toLowerCase().trim();
    const serviceType = (csvRow['Service Type'] || '').toLowerCase().trim();

    // Find matching service in database
    const match = services.find(s =>
      s.job_site?.name?.toLowerCase().trim() === jobSiteName &&
      s.service_type?.toLowerCase().trim() === serviceType
    );

    if (match && oldId) {
      serviceMap.set(oldId, match.id);
    }
  }

  console.log(`Built mappings for ${serviceMap.size} services`);

  // Now import history
  const historyPath = join(DATA_DIR, 'action-history.csv');
  if (!existsSync(historyPath)) {
    console.error('No action-history.csv found');
    return;
  }

  const historyCSV = readFileSync(historyPath, 'utf-8');
  const historyData = parseCSV(historyCSV);

  console.log(`Found ${historyData.length} history records to import`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of historyData) {
    const oldServiceId = row['Service ID'] || '';
    const serviceUUID = serviceMap.get(oldServiceId);

    if (!serviceUUID) {
      skipped++;
      continue;
    }

    // Parse action type
    const actionTypeRaw = (row['Action Type'] || '').toUpperCase();
    let eventType = 'completed';
    let rescheduledTo = null;
    let completedDate = null;

    if (actionTypeRaw.includes('CANCEL')) {
      eventType = 'cancelled';
    } else if (actionTypeRaw.includes('RESCHEDULE')) {
      eventType = 'rescheduled';
      // Parse the rescheduled date from Action Date column for reschedules
      rescheduledTo = parseDate(row['Action Date']);
    } else if (actionTypeRaw.includes('COMPLETE')) {
      eventType = 'completed';
      completedDate = parseDate(row['Action Date']);
    }

    const scheduledDate = parseDate(row['Scheduled Date']);
    const eventDate = parseDate(row['Date Recorded']);

    if (!scheduledDate || !eventDate) {
      skipped++;
      continue;
    }

    const event = {
      recurring_service_id: serviceUUID,
      scheduled_date: scheduledDate,
      event_type: eventType,
      event_date: eventDate,
      rescheduled_to: rescheduledTo,
      completed_date: completedDate,
      performed_by: row['Performed By'] || 'Imported',
      notes: row['Notes'] || null,
    };

    const { error } = await supabase
      .from('service_events')
      .insert(event);

    if (error) {
      errors++;
      if (errors < 5) console.log('  Error:', error.message);
    } else {
      imported++;
    }
  }

  console.log(`\nHistory import complete:`);
  console.log(`  ${imported} imported`);
  console.log(`  ${skipped} skipped (no matching service)`);
  console.log(`  ${errors} errors`);
}

main().catch(console.error);
