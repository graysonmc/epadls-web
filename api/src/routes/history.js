import { Router } from 'express';
import { supabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/history - List service events
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, eventType, serviceId, limit = 100 } = req.query;

    let query = supabase
      .from('service_events')
      .select(`
        *,
        recurring_service:recurring_services(
          id,
          service_type,
          frequency,
          job_site:job_sites(id, name, address)
        )
      `)
      .order('event_date', { ascending: false })
      .limit(parseInt(limit));

    if (startDate) {
      query = query.gte('event_date', startDate);
    }

    if (endDate) {
      query = query.lte('event_date', endDate);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (serviceId) {
      query = query.eq('recurring_service_id', serviceId);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
