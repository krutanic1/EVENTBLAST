import mongoose from 'mongoose';

// ─── Constants ────────────────────────────────────────────
export const SEND_JOB_MAX_ATTEMPTS = 3;

// ─── Schema ───────────────────────────────────────────────
const sendJobSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'campaignId is required'],
    },

    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipient',
      required: [true, 'recipientId is required'],
    },

    googleAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoogleAccount',
      required: [true, 'googleAccountId is required'],
    },

    // ── Job lifecycle ─────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['pending', 'processing', 'sent', 'failed', 'retrying', 'cancelled'],
        message: 'status must be one of: pending, processing, sent, failed, retrying, cancelled',
      },
      default: 'pending',
    },

    /** How many times this job has been attempted */
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * ISO timestamp after which the job is eligible for the next attempt.
     * Used for exponential back-off: set to null for immediate eligibility.
     */
    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },

    /** Last error message from the most recent failed attempt */
    lastError: {
      type: String,
      trim: true,
      maxlength: [2000, 'lastError cannot exceed 2000 characters'],
    },

    /**
     * Set when a worker claims the job (optimistic locking).
     * Stale lock detection: if lockedAt is older than ~5 minutes and status
     * is still 'locked'/'processing', the job can be re-queued by a monitor.
     */
    lockedAt: {
      type: Date,
      default: null,
    },

    /** Set when the job reaches a terminal state (done / failed / cancelled) */
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,          // createdAt + updatedAt
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────
sendJobSchema.virtual('isStale').get(function () {
  if (!this.lockedAt) return false;
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  return (
    this.status === 'processing' &&
    Date.now() - this.lockedAt.getTime() > STALE_THRESHOLD_MS
  );
});

// ─── Indexes ──────────────────────────────────────────────
// Worker polling: pick up eligible pending jobs in order
sendJobSchema.index({ status: 1, nextAttemptAt: 1 });

// Per-campaign job list
sendJobSchema.index({ campaignId: 1 });

// Per-campaign + status (progress dashboard)
sendJobSchema.index({ campaignId: 1, status: 1 });

// One job per recipient per campaign (prevent duplicate sends)
sendJobSchema.index({ campaignId: 1, recipientId: 1 }, { unique: true });

// Stale lock detection (monitor queries locked jobs older than a threshold)
sendJobSchema.index({ status: 1, lockedAt: 1 });

// Per Google account (rate-limit / throttle checks)
sendJobSchema.index({ googleAccountId: 1, status: 1 });

// TTL: auto-delete terminal jobs after 90 days to keep the collection lean
sendJobSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60, partialFilterExpression: { processedAt: { $ne: null } } }
);

// ─── Model ────────────────────────────────────────────────
const SendJob = mongoose.model('SendJob', sendJobSchema);
export default SendJob;
