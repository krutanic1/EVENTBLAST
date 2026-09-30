import mongoose from 'mongoose';

// ─── Schema ───────────────────────────────────────────────
const unsubscribeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },

    /**
     * The suppressed email address.
     * Stored lowercase so lookups are always case-insensitive without collation.
     */
    email: {
      type: String,
      required: [true, 'email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
  },
  {
    timestamps: true,          // createdAt (+ updatedAt)
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────
// Unique suppression record per sender — one row per (userId, email) pair.
// This prevents duplicate unsubscribe entries for the same pair.
unsubscribeSchema.index({ userId: 1, email: 1 }, { unique: true });

// Global email lookup (cross-user suppression check before any send)
unsubscribeSchema.index({ email: 1 });

// Newest unsubscribes first (compliance reports)
unsubscribeSchema.index({ createdAt: -1 });

// ─── Static helpers ───────────────────────────────────────

/**
 * Check if a given email is suppressed for a user.
 * @param {ObjectId|string} userId
 * @param {string} email
 * @returns {Promise<boolean>}
 */
unsubscribeSchema.statics.isSuppressed = async function (userId, email) {
  const doc = await this.findOne(
    { userId, email: email.toLowerCase().trim() },
    { _id: 1 }   // projection — we only care about existence
  ).lean();
  return doc !== null;
};

/**
 * Suppress an email for a user (upsert — safe to call multiple times).
 * @param {ObjectId|string} userId
 * @param {string} email
 * @returns {Promise<void>}
 */
unsubscribeSchema.statics.suppress = async function (userId, email) {
  await this.updateOne(
    { userId, email: email.toLowerCase().trim() },
    { $setOnInsert: { userId, email: email.toLowerCase().trim() } },
    { upsert: true }
  );
};

// ─── Model ────────────────────────────────────────────────
const Unsubscribe = mongoose.model('Unsubscribe', unsubscribeSchema);
export default Unsubscribe;
