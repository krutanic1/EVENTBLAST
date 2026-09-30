import mongoose from 'mongoose';
import { encrypt, decrypt } from '../lib/crypto.js';

// ─── Schema ───────────────────────────────────────────────
const googleAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },

    googleId: {
      type: String,
      required: [true, 'googleId is required'],
      trim: true,
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

    /**
     * NEVER stored in plaintext.
     * The field always contains AES-256-GCM ciphertext (iv:tag:ciphertext, base64).
     * Use the instance methods `getRefreshToken()` and `setRefreshToken(token)` to
     * read / write the plaintext value safely.
     */
    refreshTokenEncrypted: {
      type: String,
      select: false, // excluded from all query results unless explicitly requested
    },

    calendarId: {
      type: String,
      trim: true,
    },

    calendarName: {
      type: String,
      trim: true,
      maxlength: [300, 'Calendar name cannot exceed 300 characters'],
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'revoked', 'expired', 'error'],
        message: 'status must be one of: active, revoked, expired, error',
      },
      default: 'active',
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },

    lastUsedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Instance Methods ─────────────────────────────────────

/**
 * Encrypt and store a refresh token.
 * Always call this instead of setting `refreshTokenEncrypted` directly.
 *
 * @param {string} plainToken
 */
googleAccountSchema.methods.setRefreshToken = function (plainToken) {
  if (!plainToken) throw new Error('Refresh token cannot be empty');
  this.refreshTokenEncrypted = encrypt(plainToken);
};

/**
 * Decrypt and return the refresh token plaintext.
 * The document must have been fetched with `+refreshTokenEncrypted` selected.
 *
 * @returns {string}
 */
googleAccountSchema.methods.getRefreshToken = function () {
  if (!this.refreshTokenEncrypted) {
    throw new Error(
      'refreshTokenEncrypted is not loaded. Re-query with .select("+refreshTokenEncrypted")'
    );
  }
  return decrypt(this.refreshTokenEncrypted);
};

// ─── Indexes ──────────────────────────────────────────────
// Composite unique: one Google account per user
googleAccountSchema.index({ userId: 1, googleId: 1 }, { unique: true });
// Lookup by Google account ID alone (OAuth callback)
googleAccountSchema.index({ googleId: 1 });
// Filter active accounts per user
googleAccountSchema.index({ userId: 1, status: 1 });
// Last used (background rotation jobs)
googleAccountSchema.index({ lastUsedAt: 1 });

// ─── Model ────────────────────────────────────────────────
const GoogleAccount = mongoose.model('GoogleAccount', googleAccountSchema);
export default GoogleAccount;
