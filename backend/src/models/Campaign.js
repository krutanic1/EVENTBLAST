import mongoose from 'mongoose';

// ─── Sub-schema: counters embedded in Campaign ─────────────
const statsSchema = new mongoose.Schema(
  {
    totalRecipients: { type: Number, default: 0, min: 0 },
    successful:      { type: Number, default: 0, min: 0 },
    failed:          { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// ─── Campaign Schema ──────────────────────────────────────
const campaignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },

    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },

    // ── Event window ──────────────────────────────────────
    startTime: {
      type: Date,
      required: [true, 'startTime is required'],
    },

    endTime: {
      type: Date,
      required: [true, 'endTime is required'],
      validate: {
        validator: function (v) {
          return !this.startTime || v > this.startTime;
        },
        message: 'endTime must be after startTime',
      },
    },

    timezone: {
      type: String,
      required: [true, 'timezone is required'],
      trim: true,
      default: 'UTC',
      maxlength: [100, 'Timezone string cannot exceed 100 characters'],
    },

    // ── Google Calendar account used to send invitations ──
    googleAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoogleAccount',
    },

    // ── Workflow state ────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed'],
        message: 'status must be one of: draft, scheduled, sending, sent, paused, cancelled, failed',
      },
      default: 'draft',
    },

    // ── Aggregated counters (denormalised for dashboard reads) ──
    totalRecipients: { type: Number, default: 0, min: 0 },
    successful:      { type: Number, default: 0, min: 0 },
    failed:          { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,          // createdAt + updatedAt
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────
campaignSchema.virtual('successRate').get(function () {
  if (!this.totalRecipients || this.totalRecipients === 0) return 0;
  return Number(((this.successful / this.totalRecipients) * 100).toFixed(1));
});

campaignSchema.virtual('recipients', {
  ref:          'Recipient',
  localField:   '_id',
  foreignField: 'campaignId',
});

// ─── Indexes ──────────────────────────────────────────────
// Most common dashboard query: all campaigns for a user, newest first
campaignSchema.index({ userId: 1, createdAt: -1 });
// Filter by status (e.g. find all "sending" campaigns for processing)
campaignSchema.index({ userId: 1, status: 1 });
// Scheduler: find campaigns due to send
campaignSchema.index({ status: 1, startTime: 1 });
// createdAt descending for admin queries
campaignSchema.index({ createdAt: -1 });

// ─── Model ────────────────────────────────────────────────
const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;
