import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('Adding formatted ID columns...\n');

  // Read CSV files
  const jobSitesCsv = readFileSync('./data/import/job-sites.csv', 'utf-8');
  const servicesCsv = readFileSync('./data/import/recurring-services.csv', 'utf-8');

  const jobSitesData = parse(jobSitesCsv, { columns: true, skip_empty_lines: true });
  const servicesData = parse(servicesCsv, { columns: true, skip_empty_lines: true });

  console.log(`Found ${jobSitesData.length} job sites in CSV`);
  console.log(`Found ${servicesData.length} services in CSV\n`);

  // Get existing records from database
  const { data: dbJobSites, error: jsError } = await supabase
    .from('job_sites')
    .select('id, name');

  if (jsError) {
    console.error('Error fetching job sites:', jsError);
    return;
  }

  const { data: dbServices, error: svcError } = await supabase
    .from('recurring_services')
    .select('id, service_type, job_site:job_sites(name)');

  if (svcError) {
    console.error('Error fetching services:', svcError);
    return;
  }

  console.log(`Found ${dbJobSites.length} job sites in database`);
  console.log(`Found ${dbServices.length} services in database\n`);

  // Update job sites
  console.log('Updating job sites with job_site_id...');
  let jsUpdated = 0;
  let jsNotFound = [];

  for (const csvRow of jobSitesData) {
    const jobSiteId = csvRow['Job Site ID'];
    const jobSiteName = csvRow['Job Site Name'];

    // Find matching record in database by name (with trimming)
    const dbRecord = dbJobSites.find(js => js.name?.trim() === jobSiteName?.trim());

    if (dbRecord) {
      const { error } = await supabase
        .from('job_sites')
        .update({ job_site_id: jobSiteId })
        .eq('id', dbRecord.id);

      if (error) {
        console.error(`  Error updating ${jobSiteName}:`, error.message);
      } else {
        jsUpdated++;
      }
    } else {
      jsNotFound.push(jobSiteName);
    }
  }

  console.log(`  Updated: ${jsUpdated}`);
  if (jsNotFound.length > 0) {
    console.log(`  Not found in DB: ${jsNotFound.length}`);
  }

  // Update services
  console.log('\nUpdating services with service_id...');
  let svcUpdated = 0;
  let svcNotFound = [];

  for (const csvRow of servicesData) {
    let serviceId = csvRow['Service ID'];
    const jobSiteName = csvRow['Job Site Name'];
    const serviceType = csvRow['Service Type'];

    // Normalize service ID format: "-SVC 1.00" -> "SVC-0001"
    const match = serviceId.match(/-?SVC\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[1]);
      serviceId = `SVC-${num.toString().padStart(4, '0')}`;
    }

    // Find matching record in database by job site name + service type (with trimming)
    const dbRecord = dbServices.find(svc =>
      svc.job_site?.name?.trim() === jobSiteName?.trim() &&
      svc.service_type?.trim() === serviceType?.trim()
    );

    if (dbRecord) {
      const { error } = await supabase
        .from('recurring_services')
        .update({ service_id: serviceId })
        .eq('id', dbRecord.id);

      if (error) {
        console.error(`  Error updating ${serviceId}:`, error.message);
      } else {
        svcUpdated++;
      }
    } else {
      svcNotFound.push(`${jobSiteName} - ${serviceType.substring(0, 30)}...`);
    }
  }

  console.log(`  Updated: ${svcUpdated}`);
  if (svcNotFound.length > 0) {
    console.log(`  Not found in DB: ${svcNotFound.length}`);
    if (svcNotFound.length <= 10) {
      svcNotFound.forEach(s => console.log(`    - ${s}`));
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
