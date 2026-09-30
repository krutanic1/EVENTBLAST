import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/health
 * Returns API liveness, DB status, uptime, and version.
 */
router.get('/', async (_req, res) => {
  const dbState = mongoose.connection.readyState;
  let dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  let latency = null;

  if (dbState === 1 && mongoose.connection.db) {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      latency = Date.now() - start;
    } catch (err) {
      dbStatus = 'error';
    }
  }

  res.json({
    success: true,
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      database: {
        status: dbStatus,
        latencyMs: latency,
        name: 'MongoDB Atlas',
      },
    },
  });
});

export default router;
