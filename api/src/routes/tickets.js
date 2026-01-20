import { Router } from 'express';
import { TicketService } from '../services/TicketService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/tickets - Generate PDF tickets
router.post('/', async (req, res, next) => {
  try {
    const { services } = req.body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      throw new AppError('services array is required');
    }

    const pdfBuffer = await TicketService.generateTickets(services);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="service-tickets.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
