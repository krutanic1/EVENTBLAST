import mongoose from 'mongoose';

// ─── Schema ───────────────────────────────────────────────
const recipientSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'campaignId is required'],
    },

    email: {
      type: String,
      required: [true, 'email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    name: {
      type: String,
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },

    // ── Delivery state ─────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['pending', 'queued', 'sending', 'sent', 'failed', 'bounced', 'unsubscribed'],
        message: 'status must be one of: pending, queued, sending, sent, failed, bounced, unsubscribed',
      },
      default: 'pending',
    },

    // ── Consent / compliance ──────────────────────────────
    consentStatus: {
      type: String,
      enum: {
        values: ['unknown', 'granted', 'revoked'],
        message: 'consentStatus must be one of: unknown, granted, revoked',
      },
      default: 'unknown',
    },

    // ── Delivery metadata ─────────────────────────────────
    sentAt: {
      type: Date,
    },

    /** Last error message from the send attempt */
    error: {
      type: String,
      trim: true,
      maxlength: [2000, 'error message cannot exceed 2000 characters'],
    },

    /** Total number of delivery attempts made */
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,          // createdAt + updatedAt
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────
// Primary access pattern: all recipients for a campaign
recipientSchema.index({ campaignId: 1 });
// Filter recipients by delivery status (progress reports, retry logic)
recipientSchema.index({ campaignId: 1, status: 1 });
// Check if a specific email is already a recipient of a campaign (dedup)
recipientSchema.index({ campaignId: 1, email: 1 }, { unique: true });
// Global unsubscribe / bounce suppression lookup
recipientSchema.index({ email: 1, status: 1 });
// Fetch failed/pending recipients for retry jobs
recipientSchema.index({ status: 1, attempts: 1 });

// ─── Model ────────────────────────────────────────────────
const Recipient = mongoose.model('Recipient', recipientSchema);
export default Recipient;
