/**
 * Clean re-import script - fixes date parsing issues
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

// ID mappings
const jobSiteMap = new Map(); // old ID or lowercase name -> UUID
const serviceMap = new Map(); // old service ID -> UUID

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

/**
 * Parse date with better handling for edge cases
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  const upper = dateStr.toUpperCase().trim();

  // Handle PAUSED or other non-date values
  if (upper === 'PAUSED' || upper === 'N/A' || upper === '') {
    return null;
  }

  // Fix common typos like "09/11/20250" -> "09/11/2025"
  let cleaned = dateStr.trim();

  // Handle dates with 5+ digit years (typos)
  const badYearMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{5,})/);
  if (badYearMatch) {
    const [, month, day, year] = badYearMatch;
    // Take first 4 digits of year
    cleaned = `${month}/${day}/${year.substring(0, 4)}`;
  }

  // Handle M/D/YY format (e.g., 12/18/25 -> 12/18/2025)
  const shortYearMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortYearMatch) {
    const [, month, day, year] = shortYearMatch;
    const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    cleaned = `${month}/${day}/${fullYear}`;
  }

  // Parse MM/DD/YYYY
  const mdyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try standard JS parsing as fallback
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  console.log(`  Warning: Could not parse date "${dateStr}"`);
  return null;
}

async function clearTables() {
  console.log('Clearing existing data...');

  // Delete in reverse order of dependencies
  await supabase.from('service_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('manifest_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('recurring_services').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('job_sites').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Tables cleared.\n');
}

async function importJobSites() {
  const filePath = join(DATA_DIR, 'job-sites.csv');
  if (!existsSync(filePath)) {
    console.error('File not found:', filePath);
    return false;
  }

  console.log('Importing Job Sites...');
  const rows = parseCSV(readFileSync(filePath, 'utf-8'));
  console.log(`Found ${rows.length} job sites`);

  let imported = 0, errors = 0;

  for (const row of rows) {
    const oldId = row['Job Site ID'] || '';
    const name = row['Job Site Name'] || '';

    if (!name) continue;

    const jobSite = {
      name,
      address: row['Address'] || '',
      street_number: row['Street Number'] || '',
      street_address: row['Street Address'] || '',
      city: row['City'] || '',
      zip_code: row['Zip Code'] || '',
      county: row['County'] || '',
      latitude: parseFloat(row['Latitude']) || null,
      longitude: parseFloat(row['Longitude']) || null,
    };

    const { data, error } = await supabase
      .from('job_sites')
      .insert(jobSite)
      .select()
      .single();

    if (error) {
      console.log(`  Error: ${name} - ${error.message}`);
      errors++;
    } else {
      jobSiteMap.set(oldId, data.id);
      jobSiteMap.set(name.toLowerCase(), data.id);
      imported++;
    }
  }

  console.log(`Job Sites: ${imported} imported, ${errors} errors\n`);
  return true;
}

async function importServices() {
  const filePath = join(DATA_DIR, 'recurring-services.csv');
  if (!existsSync(filePath)) {
    console.error('File not found:', filePath);
    return false;
  }

  console.log('Importing Recurring Services...');
  const rows = parseCSV(readFileSync(filePath, 'utf-8'));
  console.log(`Found ${rows.length} services`);

  let imported = 0, errors = 0, skipped = 0;

  for (const row of rows) {
    const oldServiceId = row['Service ID'] || '';
    const oldJobSiteId = row['Job Site ID'] || '';
    const jobSiteName = (row['Job Site Name'] || '').toLowerCase();

    // Find job site UUID
    let jobSiteUUID = jobSiteMap.get(oldJobSiteId) || jobSiteMap.get(jobSiteName);

    if (!jobSiteUUID) {
      console.log(`  Skipping: no job site for "${row['Job Site Name']}"`);
      skipped++;
      continue;
    }

    const lastServiceDate = parseDate(row['Last Service Date']);

    // Determine if service is active (PAUSED = inactive)
    const isActive = row['Last Service Date']?.toUpperCase().trim() !== 'PAUSED';

    const service = {
      job_site_id: jobSiteUUID,
      service_type: row['Service Type'] || '',
      frequency: row['Frequency'] || '',
      last_service_date: lastServiceDate,
      day_constraint: row['Day Constraint'] || null,
      time_constraint: row['Time Constraint'] || null,
      priority: parseInt(row['Priority']) || 0,
      notes: row['Notes'] || null,
      manifest_county: row['Manifest County'] || null,
      is_active: isActive,
    };

    if (!service.service_type || !service.frequency) {
      skipped++;
      continue;
    }

    const { data, error } = await supabase
      .from('recurring_services')
      .insert(service)
      .select()
      .single();

    if (error) {
      console.log(`  Error: ${row['Service ID']} - ${error.message}`);
      errors++;
    } else {
      serviceMap.set(oldServiceId, data.id);
      imported++;
    }
  }

  console.log(`Services: ${imported} imported, ${skipped} skipped, ${errors} errors\n`);
  return true;
}

async function importHistory() {
  const filePath = join(DATA_DIR, 'action-history.csv');
  if (!existsSync(filePath)) {
    console.log('No action history file found, skipping.\n');
    return true;
  }

  console.log('Importing Action History...');
  const rows = parseCSV(readFileSync(filePath, 'utf-8'));
  console.log(`Found ${rows.length} history records`);

  let imported = 0, errors = 0, skipped = 0;

  for (const row of rows) {
    const oldServiceId = row['Service ID'] || '';
    const serviceUUID = serviceMap.get(oldServiceId);

    if (!serviceUUID) {
      skipped++;
      continue;
    }

    const actionTypeRaw = (row['Action Type'] || '').toUpperCase();
    let eventType = 'completed';
    let rescheduledTo = null;
    let completedDate = null;

    if (actionTypeRaw.includes('CANCEL')) {
      eventType = 'cancelled';
    } else if (actionTypeRaw.includes('RESCHEDULE')) {
      eventType = 'rescheduled';
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
      if (errors <= 5) console.log(`  Error: ${error.message}`);
    } else {
      imported++;
    }
  }

  console.log(`History: ${imported} imported, ${skipped} skipped, ${errors} errors\n`);
  return true;
}

async function main() {
  console.log('='.repeat(50));
  console.log('EPADLS Full Re-Import');
  console.log('='.repeat(50) + '\n');

  await clearTables();
  await importJobSites();
  await importServices();
  await importHistory();

  console.log('='.repeat(50));
  console.log('Re-import complete!');
  console.log('='.repeat(50));
}

main().catch(console.error);
