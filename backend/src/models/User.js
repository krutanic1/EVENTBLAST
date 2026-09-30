import mongoose from 'mongoose';

// ─── Schema ───────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
  },
  {
    timestamps: true,          // adds createdAt + updatedAt
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────
/** Backfill: list of connected Google accounts */
userSchema.virtual('googleAccounts', {
  ref:          'GoogleAccount',
  localField:   '_id',
  foreignField: 'userId',
});

// ─── Indexes ──────────────────────────────────────────────
// email uniqueness is enforced by { unique: true } on the field above.
// Additional index for time-range queries on createdAt.
userSchema.index({ createdAt: -1 });

// ─── Model ────────────────────────────────────────────────
const User = mongoose.model('User', userSchema);
export default User;
