import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import jobSitesRoutes from './routes/jobSites.js';
import servicesRoutes from './routes/services.js';
import scheduleRoutes from './routes/schedule.js';
import calendarRoutes from './routes/calendar.js';
import historyRoutes from './routes/history.js';
import manifestsRoutes from './routes/manifests.js';
import ticketsRoutes from './routes/tickets.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/job-sites', jobSitesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/manifests', manifestsRoutes);
app.use('/api/tickets', ticketsRoutes);

// Error handling
app.use(errorHandler);

export default app;
