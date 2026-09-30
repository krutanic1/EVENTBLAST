import mongoose from 'mongoose';
import SendJob from '../models/SendJob.js';
import Recipient from '../models/Recipient.js';
import GoogleAccount from '../models/GoogleAccount.js';
import Campaign from '../models/Campaign.js';
import { createCalendarEvent } from './googleCalendar.js';

const STALE_LOCK_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the maximum allowed retries from environment (default: 3)
 */
function getMaxRetries() {
  return parseInt(process.env.MAX_JOB_RETRIES, 10) || 3;
}

/**
 * Determine if an error is permanent (do not retry).
 */
function isPermanentError(error) {
  const code = error.code || error.status;
  if (code) {
    // 401: Unauthorized (Invalid credentials)
    // 403: Forbidden (Insufficient permissions / quota exceeded for auth)
    // 404: Not Found (Calendar deleted)
    // 409: Conflict (Duplicate event, already exists)
    // 429: Too Many Requests (Rate limited -> temporary)
    // 5xx: Server Errors (Temporary)
    if ([401, 403, 404, 409].includes(code)) {
      return true;
    }
    if (code >= 400 && code < 500 && code !== 429) {
      return true;
    }
  }
  if (error.message && error.message.includes('missing a refresh token')) {
    return true;
  }
  return false;
}

/**
 * Calculates exponential backoff: (2^attempts * 1 minute) + jitter
 */
function calculateNextAttempt(attempts) {
  const baseDelayMs = Math.pow(2, attempts) * 60 * 1000;
  // Add up to 30 seconds of random jitter to avoid thundering herds
  const jitterMs = Math.floor(Math.random() * 30000); 
  return new Date(Date.now() + baseDelayMs + jitterMs);
}

/**
 * Process a single eligible job from the database.
 * Uses atomic locking (`findOneAndUpdate`) to prevent duplicates.
 * 
 * @param {mongoose.Types.ObjectId[]} activeCampaignIds - Array of active campaign IDs
 * @returns {Promise<boolean>} True if a job was processed, false if queue is empty.
 */
export async function processNextJob(activeCampaignIds) {
  // If there are no active campaigns, don't even bother querying jobs
  if (!activeCampaignIds || activeCampaignIds.length === 0) {
    return false;
  }

  // 1 & 2. Find eligible pending/retrying job and atomically lock it
  const job = await SendJob.findOneAndUpdate(
    {
      campaignId: { $in: activeCampaignIds },
      status: { $in: ['pending', 'retrying'] },
      nextAttemptAt: { $lte: new Date() },
    },
    {
      $set: {
        status: 'processing',
        lockedAt: new Date(),
      }
    },
    {
      sort: { nextAttemptAt: 1 }, // Oldest eligible first
      new: true, // Return the updated document
    }
  ).populate('campaignId').populate('recipientId');

  if (!job) {
    return false; // Queue empty
  }

  // Explicitly fetch the Google Account with the refresh token
  const googleAccount = await GoogleAccount.findById(job.googleAccountId).select('+refreshTokenEncrypted').lean();
  
  if (!googleAccount) {
    throw new Error('Google Account not found in database');
  }

  const { campaignId: campaign, recipientId: recipient } = job;
  const attempts = job.attempts + 1;

  try {
    // 4 & 5. Call the Calendar service
    console.log('--- CALLING CREATE CALENDAR EVENT ---');
    console.log('googleAccount keys:', Object.keys(googleAccount));
    console.log('has token:', !!googleAccount.refreshTokenEncrypted);

    const result = await createCalendarEvent({
      googleAccount,
      campaign,
      recipients: [recipient],
    });

    if (result.success) {
      // 6 & 7. Mark successful and record event ID
      await Promise.all([
        SendJob.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'sent',
              attempts,
              processedAt: new Date(),
            },
            $unset: { lockedAt: "" }
          }
        ),
        Recipient.updateOne(
          { _id: recipient._id },
          {
            $set: {
              status: 'sent',
              email: '[deleted for privacy]',
              name: '[deleted for privacy]',
              sentAt: new Date(),
              attempts,
              // Record Google event ID on recipient for reference
              error: result.eventId, 
            }
          }
        ),
        Campaign.updateOne(
          { _id: campaign._id },
          { $inc: { successful: 1 } }
        )
      ]);
    } else {
      throw Object.assign(new Error(result.error), { code: result.code });
    }
  } catch (error) {
    // 8. Record errors & handle retries
    const isPermanent = isPermanentError(error);
    const hitMaxRetries = attempts >= getMaxRetries();
    const code = error.code || error.status;

    // Structured logging for debugging (no tokens)
    console.error(`[Job ${job._id}] Error processing recipient ${recipient.email}:`, {
      message: error.message,
      code,
      isPermanent,
      attempts,
    });

    // Handle authentication failures (401 / 403)
    if (code === 401 || code === 403) {
      console.warn(`[Job ${job._id}] Auth error for account ${googleAccount.email}. Marking revoked.`);
      await GoogleAccount.updateOne(
        { _id: googleAccount._id },
        { $set: { status: 'revoked' } }
      );
    }
    
    // 9 & 10. Retry temporary or fail permanently
    if (isPermanent || hitMaxRetries) {
      // Permanent failure
      await Promise.all([
        SendJob.updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'failed',
              lastError: error.message || 'Unknown error',
              attempts,
              processedAt: new Date(),
            },
            $unset: { lockedAt: "" }
          }
        ),
        Recipient.updateOne(
          { _id: recipient._id },
          {
            $set: {
              status: 'failed',
              error: error.message || 'Unknown error',
              attempts,
            }
          }
        ),
        Campaign.updateOne(
          { _id: campaign._id },
          { $inc: { failed: 1 } }
        )
      ]);
    } else {
      // Temporary error - requeue for retry (e.g. 429, 500, 502, 503, 504)
      await SendJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'retrying',
            lastError: error.message || 'Unknown error',
            attempts,
            nextAttemptAt: calculateNextAttempt(attempts),
          },
          $unset: { lockedAt: "" }
        }
      );
      
      // Update recipient attempts
      await Recipient.updateOne(
        { _id: recipient._id },
        { $set: { attempts } }
      );
    }
  }

  return true;
}

/**
 * 12. Release stale locks.
 */
export async function releaseStaleLocks() {
  const threshold = new Date(Date.now() - STALE_LOCK_MS);
  
  await SendJob.updateMany(
    {
      status: 'processing',
      lockedAt: { $lte: threshold }
    },
    [
      {
        $set: {
          status: { $cond: { if: { $gt: ["$attempts", 0] }, then: "retrying", else: "pending" } },
          nextAttemptAt: new Date(),
          lastError: "Worker crashed or timed out (stale lock released)",
        }
      },
      {
        $unset: "lockedAt"
      }
    ]
  );
}

/**
 * Vercel-compatible bounded batch processor.
 * Processes a fixed number of jobs and then exits, suitable for cron invocations.
 * @param {number} batchSize Maximum number of jobs to process in this invocation.
 * @returns {Promise<number>} Number of jobs processed.
 */
export async function processBatch(batchSize = 10) {
  let processedCount = 0;
  
  // Clean up any old stale locks before starting
  await releaseStaleLocks();

  // Find all active campaigns
  const activeCampaigns = await Campaign.find({ status: 'active' }, { _id: 1 }).lean();
  const activeCampaignIds = activeCampaigns.map(c => c._id);

  if (activeCampaignIds.length === 0) {
    return 0; // Nothing to do
  }

  for (let i = 0; i < batchSize; i++) {
    try {
      const processed = await processNextJob(activeCampaignIds);
      if (!processed) {
        break; // Queue empty
      }
      processedCount++;
    } catch (err) {
      console.error('[ProcessBatch] Unexpected error:', err);
      // We can optionally break here or continue to next job
      break; 
    }
  }
  
  return processedCount;
}
