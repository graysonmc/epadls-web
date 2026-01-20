/**
 * Import script for migrating data from Google Sheets CSV exports
 *
 * Usage:
 *   node scripts/import-from-sheets.js [command]
 *
 * Commands:
 *   job-sites      Import job sites from data/import/job-sites.csv
 *   services       Import recurring services from data/import/recurring-services.csv
 *   history        Import action history from data/import/action-history.csv
 *   all            Import all data in correct order
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const DATA_DIR = join(__dirname, '..', 'data', 'import');

// ID mapping: old sheet IDs -> new UUIDs
const idMaps = {
  jobSites: new Map(),    // old Job Site ID -> new UUID
  services: new Map(),    // old Service ID -> new UUID
};

/**
 * Parse CSV content into array of objects
 */
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
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

/**
 * Parse a single CSV line, handling quoted values
 */
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
 * Import Job Sites
 */
async function importJobSites() {
  const filePath = join(DATA_DIR, 'job-sites.csv');

  if (!existsSync(filePath)) {
    console.error('File not found:', filePath);
    console.log('Please export "Job Sites" sheet as CSV and save to:', filePath);
    return false;
  }

  console.log('Importing Job Sites...');
  const content = readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} job sites to import`);

  let imported = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const oldId = row['Job Site ID'] || row['id'] || '';

      const jobSite = {
        name: row['Job Site Name'] || row['name'] || '',
        address: row['Address'] || row['address'] || '',
        street_number: row['Street Number'] || row['street_number'] || '',
        street_address: row['Street Address'] || row['street_address'] || '',
        city: row['City'] || row['city'] || '',
        zip_code: row['Zip Code'] || row['zip_code'] || '',
        county: row['County'] || row['county'] || '',
        latitude: parseFloat(row['Latitude'] || row['latitude']) || null,
        longitude: parseFloat(row['Longitude'] || row['longitude']) || null,
      };

      if (!jobSite.name) {
        console.log('  Skipping row with no name');
        continue;
      }

      const { data, error } = await supabase
        .from('job_sites')
        .insert(jobSite)
        .select()
        .single();

      if (error) {
        console.error(`  Error importing "${jobSite.name}":`, error.message);
        errors++;
      } else {
        // Store ID mapping
        if (oldId) {
          idMaps.jobSites.set(oldId, data.id);
        }
        idMaps.jobSites.set(jobSite.name.toLowerCase(), data.id);
        imported++;
      }
    } catch (err) {
      console.error('  Error processing row:', err.message);
      errors++;
    }
  }

  console.log(`Job Sites: ${imported} imported, ${errors} errors`);
  return errors === 0;
}

/**
 * Import Recurring Services
 */
async function importServices() {
  const filePath = join(DATA_DIR, 'recurring-services.csv');

  if (!existsSync(filePath)) {
    console.error('File not found:', filePath);
    console.log('Please export "Recurring Services" sheet as CSV and save to:', filePath);
    return false;
  }

  console.log('Importing Recurring Services...');
  const content = readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} services to import`);

  let imported = 0;
  let errors = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const oldServiceId = row['Service ID'] || row['id'] || '';
      const oldJobSiteId = row['Job Site ID'] || '';
      const jobSiteName = (row['Job Site Name'] || row['Job Site'] || '').toLowerCase();

      // Find the job site UUID
      let jobSiteUUID = idMaps.jobSites.get(oldJobSiteId) || idMaps.jobSites.get(jobSiteName);

      if (!jobSiteUUID) {
        // Try to find by name in database
        const { data: sites } = await supabase
          .from('job_sites')
          .select('id')
          .ilike('name', jobSiteName)
          .limit(1);

        if (sites && sites.length > 0) {
          jobSiteUUID = sites[0].id;
          idMaps.jobSites.set(jobSiteName, jobSiteUUID);
        }
      }

      if (!jobSiteUUID) {
        console.log(`  Skipping service - no job site found for: "${row['Job Site Name']}"`);
        skipped++;
        continue;
      }

      // Parse last service date
      let lastServiceDate = null;
      const dateStr = row['Last Service Date'] || row['last_service_date'] || '';
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          lastServiceDate = parsed.toISOString().split('T')[0];
        }
      }

      const service = {
        job_site_id: jobSiteUUID,
        service_type: row['Service Type'] || row['service_type'] || '',
        frequency: row['Frequency'] || row['frequency'] || '',
        last_service_date: lastServiceDate,
        day_constraint: row['Day Constraint'] || row['day_constraint'] || null,
        time_constraint: row['Time Constraint'] || row['time_constraint'] || null,
        priority: parseInt(row['Priority'] || row['priority']) || 0,
        notes: row['Notes'] || row['notes'] || null,
        manifest_county: row['Manifest County'] || row['manifest_county'] || null,
        is_active: true,
      };

      if (!service.service_type || !service.frequency) {
        console.log('  Skipping row with missing service_type or frequency');
        skipped++;
        continue;
      }

      const { data, error } = await supabase
        .from('recurring_services')
        .insert(service)
        .select()
        .single();

      if (error) {
        console.error(`  Error importing service:`, error.message);
        errors++;
      } else {
        // Store ID mapping
        if (oldServiceId) {
          idMaps.services.set(oldServiceId, data.id);
        }
        imported++;
      }
    } catch (err) {
      console.error('  Error processing row:', err.message);
      errors++;
    }
  }

  console.log(`Services: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return errors === 0;
}

/**
 * Import Action History
 */
async function importHistory() {
  const filePath = join(DATA_DIR, 'action-history.csv');

  if (!existsSync(filePath)) {
    console.log('No action history file found at:', filePath);
    console.log('Skipping history import (optional)');
    return true;
  }

  console.log('Importing Action History...');
  const content = readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} history records to import`);

  let imported = 0;
  let errors = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const oldServiceId = row['Service ID'] || '';
      const serviceUUID = idMaps.services.get(oldServiceId);

      if (!serviceUUID) {
        skipped++;
        continue;
      }

      // Map action type
      const actionType = (row['Action Type'] || '').toLowerCase();
      let eventType = 'completed';
      if (actionType.includes('cancel')) {
        eventType = 'cancelled';
      } else if (actionType.includes('reschedule')) {
        eventType = 'rescheduled';
      }

      // Parse dates
      const scheduledDate = row['Scheduled Date'] || '';
      const actionDate = row['Action Date'] || row['Date Recorded'] || '';

      if (!scheduledDate || !actionDate) {
        skipped++;
        continue;
      }

      const event = {
        recurring_service_id: serviceUUID,
        scheduled_date: new Date(scheduledDate).toISOString().split('T')[0],
        event_type: eventType,
        event_date: new Date(actionDate).toISOString().split('T')[0],
        performed_by: row['Performed By'] || 'Imported',
        notes: row['Notes'] || null,
      };

      // Handle rescheduled_to for reschedule events
      if (eventType === 'rescheduled' && actionType.includes(':')) {
        const newDateStr = actionType.split(':')[1]?.trim();
        if (newDateStr) {
          const newDate = new Date(newDateStr);
          if (!isNaN(newDate.getTime())) {
            event.rescheduled_to = newDate.toISOString().split('T')[0];
          }
        }
      }

      // Handle completed_date for completion events
      if (eventType === 'completed' && actionType.includes(':')) {
        const completedDateStr = actionType.split(':')[1]?.trim();
        if (completedDateStr) {
          const completedDate = new Date(completedDateStr);
          if (!isNaN(completedDate.getTime())) {
            event.completed_date = completedDate.toISOString().split('T')[0];
          }
        }
      }

      const { error } = await supabase
        .from('service_events')
        .insert(event);

      if (error) {
        errors++;
      } else {
        imported++;
      }
    } catch (err) {
      errors++;
    }
  }

  console.log(`History: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return true;
}

/**
 * Main entry point
 */
async function main() {
  const command = process.argv[2] || 'all';

  console.log('='.repeat(50));
  console.log('EPADLS Data Import');
  console.log('='.repeat(50));
  console.log('');

  switch (command) {
    case 'job-sites':
      await importJobSites();
      break;

    case 'services':
      await importServices();
      break;

    case 'history':
      await importHistory();
      break;

    case 'all':
      console.log('Importing all data in order...\n');

      // 1. Job Sites first (no dependencies)
      const jobSitesOk = await importJobSites();
      if (!jobSitesOk) {
        console.log('\nJob sites import had errors. Fix and re-run.');
      }
      console.log('');

      // 2. Services (depends on job sites)
      const servicesOk = await importServices();
      if (!servicesOk) {
        console.log('\nServices import had errors.');
      }
      console.log('');

      // 3. History (depends on services) - optional
      await importHistory();
      break;

    default:
      console.log('Unknown command:', command);
      console.log('Usage: node scripts/import-from-sheets.js [job-sites|services|history|all]');
      process.exit(1);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Import complete!');
  console.log('='.repeat(50));
}

main().catch(console.error);
