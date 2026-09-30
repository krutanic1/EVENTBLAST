/**
 * Campaign routes.
 *
 * POST /api/campaigns                      – create a draft campaign + bulk-insert recipients
 * GET  /api/campaigns                      – list campaigns for the current user
 * GET  /api/campaigns/:id                  – get one campaign
 * GET  /api/campaigns/:id/recipients       – list recipients for a campaign (paginated)
 * POST /api/campaigns/validate-recipients  – check emails against the unsubscribe list
 */

import express from 'express';
import mongoose from 'mongoose';
import { body, param, validationResult } from 'express-validator';

import { resolveUser, requireUser } from '../middleware/auth.js';
import Campaign      from '../models/Campaign.js';
import Recipient     from '../models/Recipient.js';
import Unsubscribe   from '../models/Unsubscribe.js';
import GoogleAccount from '../models/GoogleAccount.js';
import SendJob       from '../models/SendJob.js';

const router = express.Router();

// ─── Shared validate helper ────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campaigns/validate-recipients
//
// Accepts { emails: string[] } and returns which are on
// the user's unsubscribe list — used by the CSV analysis
// panel before the campaign is submitted.
//
// Order matters: this route MUST be declared BEFORE /:id routes.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/validate-recipients',
  resolveUser,
  requireUser,
  [body('emails').isArray({ min: 1 }).withMessage('emails must be a non-empty array')],
  validate,
  async (req, res, next) => {
    try {
      const normalised = req.body.emails.map((e) => String(e).toLowerCase().trim());

      const suppressed = await Unsubscribe.find(
        { userId: new mongoose.Types.ObjectId(req.userId), email: { $in: normalised } },
        { email: 1, _id: 0 }
      ).lean();

      const unsubscribedSet = new Set(suppressed.map((d) => d.email));

      res.json({
        success: true,
        data: {
          unsubscribed: [...unsubscribedSet],
          count: unsubscribedSet.size,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/campaigns
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/', resolveUser, requireUser, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { userId: new mongoose.Types.ObjectId(req.userId) };
    if (status) filter.status = status;

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('googleAccountId', 'email name calendarName status')
        .lean(),
      Campaign.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: campaigns,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campaigns
//
// Creates a draft campaign, processes recipients, and creates pending SendJobs.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/',
  resolveUser,
  requireUser,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('startTime').isISO8601().withMessage('Valid ISO start time is required'),
    body('endTime').isISO8601().withMessage('Valid ISO end time is required'),
    body('timezone').trim().notEmpty().withMessage('Timezone is required'),
    body('googleAccountId').isMongoId().withMessage('A valid Google account ID is required'),
    body('recipients').isArray({ min: 1 }).withMessage('At least one recipient is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        title, description, startTime, endTime,
        timezone, googleAccountId, recipients,
      } = req.body;

      // Verify the Google account belongs to this user
      const googleAccount = await GoogleAccount.findOne({
        _id: new mongoose.Types.ObjectId(googleAccountId),
        userId: new mongoose.Types.ObjectId(req.userId),
        status: 'active',
      }).lean();

      if (!googleAccount) {
        return res.status(400).json({
          success: false,
          message: 'Google account not found, not active, or does not belong to this user.',
        });
      }

      // Validate time order
      if (new Date(endTime) <= new Date(startTime)) {
        return res.status(400).json({
          success: false,
          message: 'endTime must be after startTime',
        });
      }

      // ── Process Recipients ──
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let invalidCount = 0;
      let duplicateCount = 0;
      let unsubscribedCount = 0;

      const validRows = [];
      for (const r of recipients) {
        const email = String(r.email || '').trim().toLowerCase();
        if (EMAIL_RE.test(email)) {
          validRows.push({ email, name: String(r.name || '').trim() });
        } else {
          invalidCount++;
        }
      }

      // Deduplicate
      const uniqueRows = [];
      const seen = new Set();
      for (const r of validRows) {
        if (seen.has(r.email)) {
          duplicateCount++;
        } else {
          seen.add(r.email);
          uniqueRows.push(r);
        }
      }

      if (uniqueRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid recipients found.',
        });
      }

      // Exclude Unsubscribed
      const suppressed = await Unsubscribe.find(
        { userId: new mongoose.Types.ObjectId(req.userId), email: { $in: Array.from(seen) } },
        { email: 1, _id: 0 }
      ).lean();
      
      const unsubscribedSet = new Set(suppressed.map((d) => d.email));
      unsubscribedCount = unsubscribedSet.size;

      const finalRecipients = uniqueRows.filter((r) => !unsubscribedSet.has(r.email));

      if (finalRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'All valid recipients are on the unsubscribe list.',
        });
      }

      // ── Create Campaign ──
      const campaign = await Campaign.create({
        userId:          new mongoose.Types.ObjectId(req.userId),
        googleAccountId: new mongoose.Types.ObjectId(googleAccountId),
        title:           title.trim(),
        description:     description?.trim() || '',
        startTime:       new Date(startTime),
        endTime:         new Date(endTime),
        timezone,
        status:          'draft',
        totalRecipients: finalRecipients.length,
        successful:      0,
        failed:          0,
      });

      // ── Insert Recipients ──
      const recipientDocs = finalRecipients.map((r) => ({
        campaignId:    campaign._id,
        email:         r.email,
        name:          r.name,
        status:        'pending',
        consentStatus: 'unknown',
        attempts:      0,
      }));

      // Insert all recipients
      const insertedRecipients = await Recipient.insertMany(recipientDocs, { ordered: false });

      // ── Insert SendJobs ──
      const sendJobDocs = insertedRecipients.map((r) => ({
        campaignId:      campaign._id,
        recipientId:     r._id,
        googleAccountId: googleAccount._id,
        status:          'pending',
        attempts:        0,
      }));

      await SendJob.insertMany(sendJobDocs, { ordered: false });

      res.status(201).json({
        success: true,
        data: {
          campaignId: campaign._id,
          totalRecipients: finalRecipients.length,
          pendingJobs: sendJobDocs.length,
          invalidRecipients: invalidCount,
          duplicates: duplicateCount,
          unsubscribed: unsubscribedCount,
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/campaigns
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get(
  '/',
  resolveUser,
  requireUser,
  async (req, res, next) => {
    try {
      const campaigns = await Campaign.find({ userId: new mongoose.Types.ObjectId(req.userId) })
        .sort({ createdAt: -1 })
        .populate('googleAccountId', 'email name')
        .lean();
      res.json({ success: true, data: campaigns });
    } catch (err) {
      next(err);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/campaigns/:id/stats
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get(
  '/:id/stats',
  resolveUser,
  requireUser,
  [param('id').isMongoId().withMessage('Invalid campaign ID')],
  validate,
  async (req, res, next) => {
    try {
      const campaign = await Campaign.findOne({
        _id: new mongoose.Types.ObjectId(req.params.id),
        userId: new mongoose.Types.ObjectId(req.userId)
      }).lean();

      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found.' });
      }

      // Aggregate SendJob statuses
      const stats = await SendJob.aggregate([
        { $match: { campaignId: campaign._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const counts = {
        total: campaign.totalRecipients,
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        retrying: 0,
        cancelled: 0
      };

      stats.forEach(s => {
        if (counts[s._id] !== undefined) {
          counts[s._id] = s.count;
        }
      });

      res.json({
        success: true,
        data: {
          campaign: {
            status: campaign.status,
            title: campaign.title,
          },
          counts
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/campaigns/:id
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get(
  '/:id',
  resolveUser,
  requireUser,
  [param('id').isMongoId().withMessage('Invalid campaign ID')],
  validate,
  async (req, res, next) => {
    try {
      const campaign = await Campaign.findOne({
        _id:    new mongoose.Types.ObjectId(req.params.id),
        userId: new mongoose.Types.ObjectId(req.userId),
      })
        .populate('googleAccountId', 'email name calendarName calendarId status')
        .lean();

      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found.' });
      }

      res.json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/campaigns/:id/recipients
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get(
  '/:id/recipients',
  resolveUser,
  requireUser,
  [param('id').isMongoId().withMessage('Invalid campaign ID')],
  validate,
  async (req, res, next) => {
    try {
      // Ownership check via campaign lookup
      const campaign = await Campaign.findOne({
        _id:    new mongoose.Types.ObjectId(req.params.id),
        userId: new mongoose.Types.ObjectId(req.userId),
      }, { _id: 1 }).lean();

      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found.' });
      }

      const { page = 1, limit = 50, status } = req.query;
      const filter = { campaignId: campaign._id };
      if (status) filter.status = status;

      const [recipients, total] = await Promise.all([
        Recipient.find(filter)
          .sort({ createdAt: 1 })
          .skip((Number(page) - 1) * Number(limit))
          .limit(Number(limit))
          .lean(),
        Recipient.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: recipients,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campaigns/:id/pause
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/:id/pause',
  resolveUser,
  requireUser,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const campaign = await Campaign.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(req.params.id), userId: new mongoose.Types.ObjectId(req.userId) },
        { $set: { status: 'paused' } },
        { new: true }
      );
      if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: campaign });
    } catch (err) { next(err); }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campaigns/:id/resume
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/:id/resume',
  resolveUser,
  requireUser,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const campaign = await Campaign.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(req.params.id), userId: new mongoose.Types.ObjectId(req.userId), status: { $in: ['draft', 'paused'] } },
        { $set: { status: 'active' } },
        { new: true }
      );
      if (!campaign) return res.status(404).json({ success: false, message: 'Not found or cannot resume' });
      
      res.json({ success: true, data: campaign });

      // 🔥 Trigger processing immediately in the background so emails fly right away
      import('../services/jobProcessor.js').then(({ processBatch }) => {
        processBatch(50).catch(err => {
          console.error('[Immediate Processor] Error:', err);
        });
      });

    } catch (err) { next(err); }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campaigns/:id/cancel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/:id/cancel',
  resolveUser,
  requireUser,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const campaign = await Campaign.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(req.params.id), userId: new mongoose.Types.ObjectId(req.userId) },
        { $set: { status: 'cancelled' } },
        { new: true }
      );
      if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });

      // Pending jobs become cancelled
      await SendJob.updateMany(
        { campaignId: campaign._id, status: { $in: ['pending', 'retrying'] } },
        { $set: { status: 'cancelled' } }
      );
      // Pending recipients become cancelled
      await Recipient.updateMany(
        { campaignId: campaign._id, status: { $in: ['pending', 'retrying'] } },
        { $set: { status: 'cancelled' } }
      );

      res.json({ success: true, data: campaign });
    } catch (err) { next(err); }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campaigns/:id/retry-failed
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/:id/retry-failed',
  resolveUser,
  requireUser,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const campaign = await Campaign.findOne({ _id: new mongoose.Types.ObjectId(req.params.id), userId: new mongoose.Types.ObjectId(req.userId) });
      if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });

      // Move failed jobs back to pending, reset attempts
      await SendJob.updateMany(
        { campaignId: campaign._id, status: 'failed' },
        { $set: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: 'Retrying explicitly' } }
      );
      await Recipient.updateMany(
        { campaignId: campaign._id, status: 'failed' },
        { $set: { status: 'pending', attempts: 0, error: 'Retrying explicitly' } }
      );

      res.json({ success: true, message: 'Failed jobs requeued.' });
    } catch (err) { next(err); }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE /api/campaigns/:id
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete(
  '/:id',
  resolveUser,
  requireUser,
  [param('id').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const campaign = await Campaign.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(req.params.id),
        userId: new mongoose.Types.ObjectId(req.userId)
      });
      
      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      // Also clean up all associated recipients and jobs
      await Promise.all([
        Recipient.deleteMany({ campaignId: campaign._id }),
        SendJob.deleteMany({ campaignId: campaign._id })
      ]);

      res.json({ success: true, message: 'Campaign deleted successfully.' });
    } catch (err) { next(err); }
  }
);

export default router;
