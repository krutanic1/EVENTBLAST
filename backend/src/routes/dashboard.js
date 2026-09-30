import express from 'express';
import mongoose from 'mongoose';
import { resolveUser, requireUser } from '../middleware/auth.js';
import Campaign from '../models/Campaign.js';
import Recipient from '../models/Recipient.js';
import SendJob from '../models/SendJob.js';
import GoogleAccount from '../models/GoogleAccount.js';

const router = express.Router();

router.get('/stats', resolveUser, requireUser, async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const [accounts, campaigns, recipientStats, jobStats, recentCampaigns] = await Promise.all([
      GoogleAccount.countDocuments({ userId, status: 'active' }),
      Campaign.countDocuments({ userId }),
      Campaign.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$totalRecipients' }, successful: { $sum: '$successful' }, failed: { $sum: '$failed' } } }
      ]),
      SendJob.countDocuments({
        campaignId: { $in: await Campaign.distinct('_id', { userId }) },
        status: { $in: ['pending', 'retrying'] }
      }),
      Campaign.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('googleAccountId', 'email name')
        .lean()
    ]);

    const stats = recipientStats[0] || { total: 0, successful: 0, failed: 0 };

    res.json({
      success: true,
      data: {
        connectedAccounts: accounts,
        totalCampaigns: campaigns,
        totalRecipients: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        pending: jobStats,
        recentCampaigns,
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
