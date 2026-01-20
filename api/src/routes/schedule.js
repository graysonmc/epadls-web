import { Router } from 'express';
import { supabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { ScheduleService } from '../services/ScheduleService.js';
import { ActionService } from '../services/ActionService.js';

const router = Router();

// GET /api/schedule - Get upcoming services
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);

    const upcomingServices = await ScheduleService.getUpcomingServices(start, end);

    res.json(upcomingServices);
  } catch (error) {
    next(error);
  }
});

// POST /api/schedule/actions - Process batch actions
router.post('/actions', async (req, res, next) => {
  try {
    const { completions, cancellations, reschedules } = req.body;

    const result = await ActionService.processActions({
      completions: completions || [],
      cancellations: cancellations || [],
      reschedules: reschedules || [],
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
