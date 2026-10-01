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

    // PERMANENT FIX: batch=1 ensures we never exceed Vercel's 10s timeout.
    // 1 Google Calendar API call (~2-3s) + MongoDB ops (~1-2s) = ~4-5s total.
    // Cron runs every minute → 1 email/min = 60/hour (reliable vs fast but broken).
    // Override via ?limit=N if on Vercel Pro (60s timeout allows up to ~15).
    const batchSize = parseInt(req.query.limit, 10) || 1;
    
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
