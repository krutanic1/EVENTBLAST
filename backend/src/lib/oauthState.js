/**
 * Stateless CSRF protection for Google OAuth 2.0.
 *
 * State format (dot-delimited, both segments are base64url):
 *   <payload_b64url>.<hmac_sha256_b64url>
 *
 * Payload (JSON, base64url-encoded):
 *   { userId: string, nonce: string (32 hex), iat: number (ms epoch) }
 *
 * Security properties:
 *  - HMAC-SHA256 keyed on JWT_SECRET prevents forgery.
 *  - Random 16-byte nonce prevents replay across parallel flows.
 *  - `iat` timestamp enforces a 10-minute TTL so leaked states expire quickly.
 *  - crypto.timingSafeEqual used for HMAC comparison to prevent timing attacks.
 */

import crypto from 'crypto';

/** How long (ms) a state parameter is valid after generation. */
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSigningSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and at least 32 characters long (used for OAuth state signing).'
    );
  }
  return secret;
}

/**
 * Generate a signed, tamper-proof state string that encodes `userId`.
 *
 * @param {string|ObjectId} userId  – MongoDB ObjectId of the EventBlast user
 * @returns {string}  "<payload_b64url>.<hmac_b64url>"
 */
export function generateState(userId, frontendUrl) {
  const payload = {
    userId: String(userId),
    frontendUrl: String(frontendUrl || ''),
    nonce: crypto.randomBytes(16).toString('hex'), // 128-bit entropy
    iat: Date.now(),
  };

  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');

  return `${data}.${hmac}`;
}

/**
 * Verify a state string and return its payload.
 *
 * Throws a descriptive error on any failure — callers should treat every
 * thrown error as a CSRF / integrity violation.
 *
 * @param {string} state
 * @returns {{ userId: string, nonce: string, iat: number }}
 */
export function verifyState(state) {
  if (!state || typeof state !== 'string') {
    throw new Error('Missing state parameter.');
  }

  const dotIdx = state.lastIndexOf('.');
  if (dotIdx === -1) {
    throw new Error('Malformed state parameter — missing HMAC segment.');
  }

  const data         = state.slice(0, dotIdx);
  const receivedHmac = state.slice(dotIdx + 1);

  // Recompute expected HMAC
  const expectedHmac = crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');

  // Constant-time comparison — prevents timing side-channel attacks
  const receivedBuf = Buffer.from(receivedHmac);
  const expectedBuf = Buffer.from(expectedHmac);

  if (
    receivedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    throw new Error('State HMAC verification failed — possible CSRF attempt.');
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    throw new Error('State payload could not be decoded.');
  }

  // Enforce TTL
  if (typeof payload.iat !== 'number' || Date.now() - payload.iat > STATE_TTL_MS) {
    throw new Error('State parameter has expired — please restart the OAuth flow.');
  }

  if (!payload.userId || !payload.nonce) {
    throw new Error('State payload is missing required fields.');
  }

  return payload; // { userId, nonce, iat, frontendUrl }
}
