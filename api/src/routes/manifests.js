import { Router } from 'express';
import { supabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/manifests - Get manifest entries
router.get('/', async (req, res, next) => {
  try {
    const { quarter, county } = req.query;

    let query = supabase
      .from('manifest_entries')
      .select(`
        *,
        job_site:job_sites(id, name, address),
        recurring_service:recurring_services(id, service_type)
      `)
      .order('date_completed', { ascending: false });

    if (quarter) {
      query = query.eq('quarter', quarter);
    }

    if (county) {
      query = query.eq('county', county);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/manifests/export - Export as CSV
router.get('/export', async (req, res, next) => {
  try {
    const { quarter, county } = req.query;

    if (!quarter || !county) {
      throw new AppError('quarter and county are required');
    }

    const { data, error } = await supabase
      .from('manifest_entries')
      .select(`
        date_completed,
        quarter,
        county,
        job_site:job_sites(name, address),
        recurring_service:recurring_services(service_type)
      `)
      .eq('quarter', quarter)
      .eq('county', county)
      .order('date_completed');

    if (error) throw new AppError(error.message);

    // Convert to CSV
    const headers = ['Date Completed', 'Quarter', 'County', 'Job Site', 'Address', 'Service Type'];
    const rows = data.map(entry => [
      entry.date_completed,
      entry.quarter,
      entry.county,
      entry.job_site?.name || '',
      entry.job_site?.address || '',
      entry.recurring_service?.service_type || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="manifest-${quarter}-${county}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
