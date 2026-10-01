import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import healthRouter    from './routes/health.js';
import eventsRouter    from './routes/events.js';
import googleRouter    from './routes/google.js';
import campaignsRouter from './routes/campaigns.js';
import jobsRouter      from './routes/jobs.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter      from './routes/auth.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// ─── Security Middleware ──────────────────────────────────
app.use(helmet());

// Dynamically handle CORS for frontend in production
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// ─── Rate Limiting ─eekufglisdhflsdnf;ihnf───────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ─── Body Parsing / Logging ───────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Routes ───────────────────────────────────────────────
app.use('/api/health',    healthRouter);
app.use('/api/events',    eventsRouter);
app.use('/api/google',    googleRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/jobs',      jobsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/auth',      authRouter);

// ─── Error Handling ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
