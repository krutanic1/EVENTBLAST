import express from 'express';
import { processBatch } from '../services/jobProcessor.js';

const router = express.Router();

/**
 * GET /api/jobs/process
 * Vercel-compatible cron endpoint to process a batch of jobs.
 * Protected by CRON_SECRET environment variable.
 */
router.get('/process', async (req, res, next) => {
  try {
    // Authenticate the invocation (Vercel sets Authorization header to Bearer CRON_SECRET)
    // Or we can check a custom header if invoked manually
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return res.status(500).json({ error: 'CRON_SECRET is not configured' });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized invocation' });
    }

    // Process a bounded batch of jobs.
    // Each Google Calendar API call takes ~1-2s.
    // Vercel Hobby timeout = 10s  → safe batch = 5
    // Vercel Pro timeout   = 60s  → safe batch = 30
    const batchSize = parseInt(req.query.limit, 10) || 5;
    
    const processedCount = await processBatch(batchSize);

    return res.json({
      success: true,
      processed: processedCount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
