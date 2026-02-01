import { Router } from 'express';
import { supabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/job-sites
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;

    let query = supabase
      .from('job_sites')
      .select('*')
      .order('name');

    if (q) {
      query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/job-sites/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('job_sites')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new AppError(error.message, 404);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/job-sites
router.post('/', async (req, res, next) => {
  try {
    const { name, address, street_number, street_address, city, zip_code, county, latitude, longitude } = req.body;

    if (!name) {
      throw new AppError('Name is required');
    }

    const { data, error } = await supabase
      .from('job_sites')
      .insert({
        name,
        address,
        street_number,
        street_address,
        city,
        zip_code,
        county,
        latitude,
        longitude,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message);

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/job-sites/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, street_number, street_address, city, zip_code, county, latitude, longitude } = req.body;

    const { data, error } = await supabase
      .from('job_sites')
      .update({
        name,
        address,
        street_number,
        street_address,
        city,
        zip_code,
        county,
        latitude,
        longitude,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/job-sites/:id/services
router.get('/:id/services', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('recurring_services')
      .select('*')
      .eq('job_site_id', id)
      .order('service_type');

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/job-sites/:id/history
router.get('/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Get all service IDs for this job site
    const { data: services, error: servicesError } = await supabase
      .from('recurring_services')
      .select('id, service_type')
      .eq('job_site_id', id);

    if (servicesError) throw new AppError(servicesError.message);

    if (!services || services.length === 0) {
      return res.json({
        events: [],
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    }

    const serviceIds = services.map(s => s.id);
    const serviceTypeMap = Object.fromEntries(services.map(s => [s.id, s.service_type]));

    // Get total count
    const { count } = await supabase
      .from('service_events')
      .select('*', { count: 'exact', head: true })
      .in('recurring_service_id', serviceIds);

    // Get paginated events
    const { data: events, error: eventsError } = await supabase
      .from('service_events')
      .select('*')
      .in('recurring_service_id', serviceIds)
      .order('event_date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (eventsError) throw new AppError(eventsError.message);

    // Add service_type to each event
    const eventsWithType = events.map(e => ({
      ...e,
      service_type: serviceTypeMap[e.recurring_service_id],
    }));

    res.json({
      events: eventsWithType,
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/job-sites/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('job_sites')
      .delete()
      .eq('id', id);

    if (error) throw new AppError(error.message);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
