import { Router } from 'express';
import { ScheduleService } from '../services/ScheduleService.js';

const router = Router();

// GET /api/calendar - Get calendar data for a month
router.get('/', async (req, res, next) => {
  try {
    const { year, month } = req.query;

    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;

    // Get first and last day of the month
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0); // Last day of month

    const services = await ScheduleService.getUpcomingServices(startDate, endDate);

    // Group services by date
    const servicesByDate = {};
    services.forEach(service => {
      const dateKey = service.scheduled_date.toISOString().split('T')[0];
      if (!servicesByDate[dateKey]) {
        servicesByDate[dateKey] = [];
      }
      servicesByDate[dateKey].push(service);
    });

    res.json({
      year: y,
      month: m,
      services: servicesByDate,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
