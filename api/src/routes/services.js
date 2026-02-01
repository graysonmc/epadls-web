import { Router } from 'express';
import { supabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/services
router.get('/', async (req, res, next) => {
  try {
    const { active } = req.query;

    let query = supabase
      .from('recurring_services')
      .select(`
        *,
        job_site:job_sites(id, name, address, city, county)
      `)
      .order('created_at', { ascending: false });

    if (active !== undefined) {
      query = query.eq('is_active', active === 'true');
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/services/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('recurring_services')
      .select(`
        *,
        job_site:job_sites(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw new AppError(error.message, 404);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/services
router.post('/', async (req, res, next) => {
  try {
    const {
      job_site_id,
      service_type,
      frequency,
      last_service_date,
      day_constraint,
      time_constraint,
      priority,
      notes,
      office_notes,
      manifest_county,
    } = req.body;

    if (!job_site_id || !service_type || !frequency) {
      throw new AppError('job_site_id, service_type, and frequency are required');
    }

    const { data, error } = await supabase
      .from('recurring_services')
      .insert({
        job_site_id,
        service_type,
        frequency,
        last_service_date,
        day_constraint,
        time_constraint,
        priority: priority || 0,
        notes,
        office_notes,
        manifest_county,
        is_active: true,
      })
      .select(`
        *,
        job_site:job_sites(id, name, address, city, county)
      `)
      .single();

    if (error) throw new AppError(error.message);

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/services/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      job_site_id,
      service_type,
      frequency,
      last_service_date,
      day_constraint,
      time_constraint,
      priority,
      notes,
      office_notes,
      manifest_county,
      is_active,
    } = req.body;

    const { data, error } = await supabase
      .from('recurring_services')
      .update({
        job_site_id,
        service_type,
        frequency,
        last_service_date,
        day_constraint,
        time_constraint,
        priority,
        notes,
        office_notes,
        manifest_county,
        is_active,
      })
      .eq('id', id)
      .select(`
        *,
        job_site:job_sites(id, name, address, city, county)
      `)
      .single();

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/services/:id/history
router.get('/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Get total count
    const { count } = await supabase
      .from('service_events')
      .select('*', { count: 'exact', head: true })
      .eq('recurring_service_id', id);

    // Get paginated events
    const { data, error } = await supabase
      .from('service_events')
      .select('*')
      .eq('recurring_service_id', id)
      .order('event_date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw new AppError(error.message);

    res.json({
      events: data,
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/services/:id (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('recurring_services')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
