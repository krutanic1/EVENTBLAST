/**
 * Google OAuth 2.0 routes for EventBlast.
 *
 * Flow:
 *  1.  GET  /api/google/auth             → redirect to Google consent screen
 *  2.  GET  /api/google/callback         → exchange code, save account, redirect frontend
 *  3.  GET  /api/google/accounts         → list this user's connected Google accounts
 *  4.  DELETE /api/google/accounts/:id   → disconnect a Google account
 *
 * Security guarantees:
 *  - Refresh tokens are NEVER sent to the browser (select: false on the field).
 *  - Refresh tokens are stored AES-256-GCM encrypted at rest.
 *  - OAuth CSRF is prevented by a stateless HMAC-signed `state` parameter.
 *  - The GOOGLE_CLIENT_SECRET never leaves the server process.
 *  - Duplicate Google accounts (same googleId per user) are prevented by upsert.
 *  - Multiple Google accounts per EventBlast user are fully supported.
 */

import express from 'express';
import { google } from 'googleapis';
import mongoose from 'mongoose';

import { generateState, verifyState } from '../lib/oauthState.js';
import { resolveUser, requireUser } from '../middleware/auth.js';
import GoogleAccount from '../models/GoogleAccount.js';
import User from '../models/User.js';

const router = express.Router();

// ─── OAuth Scopes ─────────────────────────────────────────
// Principle of Least Privilege — only request what EventBlast actually needs:
//   • openid + email + profile  → identify the Google account
//   • calendar.events           → create, update and delete Calendar events (the core feature)
//   • calendar.readonly         → read the user's calendar list to find the primary calendar ID
const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

// ─── Helpers ──────────────────────────────────────────────

/** Build a fresh OAuth2 client from environment variables. */
function buildOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.'
    );
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/** Safe redirect to the React frontend with an error message. */
function redirectError(res, message, frontendUrl) {
  const base = frontendUrl || 'https://eventblast.vercel.app';
  return res.redirect(
    `${base}/dashboard/accounts?tab=google&error=${encodeURIComponent(message)}`
  );
}

/** Safe redirect to the React frontend after a successful connection. */
function redirectSuccess(res, email, frontendUrl) {
  const base = frontendUrl || 'https://eventblast.vercel.app';
  return res.redirect(
    `${base}/dashboard/accounts?tab=google&connected=1&account=${encodeURIComponent(email)}`
  );
}

// ─── Rate limiter specific to OAuth initiation ────────────
import { rateLimit } from 'express-rate-limit';

const oauthLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OAuth requests. Please wait a moment.' },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/google/auth?userId=<ObjectId>
//
// Initiates the Google OAuth 2.0 web-server flow.
// Generates a signed state parameter (CSRF protection) and redirects the
// browser to Google's consent screen.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/auth', oauthLimiter, resolveUser, requireUser, async (req, res, next) => {
  try {
    const oAuth2Client = buildOAuthClient();
    const frontendUrl = req.query.frontendUrl;

    // Generate HMAC-signed state (embeds userId + frontendUrl + random nonce + timestamp)
    const state = generateState(req.userId, frontendUrl);

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',        // request a refresh token
      scope: SCOPES,
      state,
      // Force the consent screen on every request so Google always returns a
      // fresh refresh token, even if the user has previously authorised the app.
      prompt: 'consent select_account',
      include_granted_scopes: true,
    });

    return res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/google/callback?code=...&state=...
//
// Google redirects here after the user approves (or denies) access.
//
// Steps on success:
//  1. Validate state (CSRF check + TTL)
//  2. Exchange authorization code for tokens
//  3. Assert a refresh_token was returned
//  4. Fetch Google account info (email, name, sub/googleId)
//  5. Fetch the user's primary calendar metadata
//  6. Encrypt the refresh token (AES-256-GCM)
//  7. Upsert GoogleAccount (create or update if already connected)
//  8. Redirect the browser back to the EventBlast dashboard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/callback', async (req, res) => {
  const { code, state, error: googleError } = req.query;

  // ── 0. User denied access on Google's consent screen ──────
  if (googleError) {
    return redirectError(res, `Google denied access: ${googleError}`, '');
  }

  // ── 1. Validate CSRF state ─────────────────────────────────
  let statePayload;
  try {
    statePayload = verifyState(state);
  } catch (err) {
    console.warn('[OAuth] State verification failed:', err.message);
    return redirectError(res, `Security check failed: ${err.message}`, '');
  }

  const { userId, frontendUrl } = statePayload;

  // Confirm the EventBlast user still exists (could have been deleted mid-flow)
  const user = await User.findById(userId).lean();
  if (!user) {
    return redirectError(res, 'EventBlast user not found. Please log in again.', frontendUrl);
  }

  try {
    // ── 2. Exchange authorization code for tokens ────────────
    const oAuth2Client = buildOAuthClient();
    let tokens;
    try {
      ({ tokens } = await oAuth2Client.getToken(code));
    } catch (err) {
      console.error('[OAuth] Token exchange failed:', err.message);
      return redirectError(res, 'Failed to exchange authorization code. Please try again.', frontendUrl);
    }

    // ── 3. Assert refresh token was returned ─────────────────
    // With prompt:'consent' this should always be present, but guard anyway.
    if (!tokens.refresh_token) {
      return redirectError(
        res,
        'Google did not return a refresh token. Please revoke app access in your Google Account settings and try again.',
        frontendUrl
      );
    }

    oAuth2Client.setCredentials(tokens);

    // ── 4. Fetch Google account identity ─────────────────────
    const oauth2Api = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const { data: googleUser } = await oauth2Api.userinfo.get();

    // googleUser: { id, email, name, picture, ... }
    if (!googleUser.id || !googleUser.email) {
      return redirectError(res, 'Could not retrieve account information from Google.', frontendUrl);
    }

    // ── 5. Fetch primary calendar metadata ───────────────────
    const calendarApi = google.calendar({ version: 'v3', auth: oAuth2Client });

    let primaryCalendar = { id: 'primary', summary: 'Primary Calendar' };
    try {
      const { data } = await calendarApi.calendars.get({ calendarId: 'primary' });
      primaryCalendar = { id: data.id, summary: data.summary };
    } catch (err) {
      // Non-fatal: we still have a usable account without the exact calendar name
      console.warn('[OAuth] Could not fetch primary calendar:', err.message);
    }

    // ── 6 + 7. Encrypt refresh token and upsert account ──────
    //
    // Filter: one GoogleAccount document per (userId, googleId) pair.
    // This prevents duplicate records while supporting multiple Google
    // accounts per EventBlast user.
    const filter = { userId: new mongoose.Types.ObjectId(userId), googleId: googleUser.id };

    const existingAccount = await GoogleAccount.findOne(filter).select('+refreshTokenEncrypted');

    let account;
    if (existingAccount) {
      // Update existing connection — always rotate the refresh token
      existingAccount.email        = googleUser.email;
      existingAccount.name         = googleUser.name || googleUser.email;
      existingAccount.calendarId   = primaryCalendar.id;
      existingAccount.calendarName = primaryCalendar.summary;
      existingAccount.status       = 'active';
      existingAccount.lastUsedAt   = new Date();
      existingAccount.setRefreshToken(tokens.refresh_token); // encrypts in-place
      account = await existingAccount.save();
    } else {
      // Create a new GoogleAccount document
      account = new GoogleAccount({
        userId:       new mongoose.Types.ObjectId(userId),
        googleId:     googleUser.id,
        email:        googleUser.email,
        name:         googleUser.name || googleUser.email,
        calendarId:   primaryCalendar.id,
        calendarName: primaryCalendar.summary,
        status:       'active',
        connectedAt:  new Date(),
        lastUsedAt:   new Date(),
      });
      account.setRefreshToken(tokens.refresh_token); // encrypts in-place
      await account.save();
    }

    // ── 8. Redirect to React dashboard ───────────────────────
    // We pass only the email (not the token) to the frontend for a toast message.
    console.info(
      `[OAuth] Google account connected: ${googleUser.email} → user ${userId}`
    );
    return redirectSuccess(res, googleUser.email, frontendUrl);
  } catch (err) {
    console.error('[OAuth] Callback error:', err);
    return redirectError(res, 'An unexpected error occurred. Please try again.', frontendUrl);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/google/accounts
//
// Returns all Google accounts connected to the authenticated EventBlast user.
// Refresh tokens are NEVER included in the response.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/accounts', resolveUser, requireUser, async (req, res, next) => {
  try {
    const accounts = await GoogleAccount.find(
      { userId: new mongoose.Types.ObjectId(req.userId) },
      // Explicit field exclusion — belt-and-suspenders on top of select:false
      { refreshTokenEncrypted: 0, __v: 0 }
    )
      .sort({ connectedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (err) {
    next(err);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE /api/google/accounts/:id
//
// Disconnects (removes) a Google account.
// Validates that the account belongs to the requesting user before deletion
// to prevent horizontal privilege escalation.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete('/accounts/:id', resolveUser, requireUser, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid account ID.' });
    }

    // Ownership check embedded in the query — findOneAndDelete with both _id AND userId.
    // If the document exists but belongs to a different user, the query returns null.
    const deleted = await GoogleAccount.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(req.userId),
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Google account not found or does not belong to this user.',
      });
    }

    console.info(
      `[OAuth] Google account disconnected: ${deleted.email} from user ${req.userId}`
    );

    res.json({
      success: true,
      message: `Google account ${deleted.email} has been disconnected.`,
    });
  } catch (err) {
    next(err);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/google/status
//
// Diagnostic endpoint that reports OAuth configuration status
// without revealing secrets. Useful for production verification.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/status', (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL, NODE_ENV } = process.env;

  const isProd = NODE_ENV === 'production';
  const hasLocalhost = (str) => typeof str === 'string' && str.includes('localhost');

  const diagnostics = {
    environment: NODE_ENV || 'development',
    oauthConfigured: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI),
    checks: {
      clientIdConfigured: !!GOOGLE_CLIENT_ID,
      clientSecretConfigured: !!GOOGLE_CLIENT_SECRET,
      redirectUriConfigured: !!GOOGLE_REDIRECT_URI,
      frontendUrlConfigured: !!FRONTEND_URL,
    },
    warnings: []
  };

  // Check for localhost in production
  if (isProd) {
    if (hasLocalhost(GOOGLE_REDIRECT_URI)) {
      diagnostics.warnings.push('GOOGLE_REDIRECT_URI contains localhost in production mode.');
    }
    if (hasLocalhost(FRONTEND_URL)) {
      diagnostics.warnings.push('FRONTEND_URL contains localhost in production mode.');
    }
  }

  // Basic validation of client ID shape (Google Client IDs typically end in apps.googleusercontent.com)
  if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.endsWith('apps.googleusercontent.com')) {
    diagnostics.warnings.push('GOOGLE_CLIENT_ID does not look like a standard web application client ID.');
  }

  res.json({
    success: true,
    data: diagnostics
  });
});

export default router;
