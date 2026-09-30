/**
 * Unit tests for the OAuth state signing / verification library.
 * Run: node scripts/test-oauth-state.js
 */

import 'dotenv/config';
import { generateState, verifyState } from '../src/lib/oauthState.js';

// Ensure JWT_SECRET is set (dotenv loads from .env)
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'test_secret_for_unit_tests_min_32_chars_long!';
}

const FAKE_USER_ID = '507f1f77bcf86cd799439011'; // valid ObjectId format

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? '  →  ' + detail : ''}`);
    failed++;
  }
}

console.log('\n── OAuth State Library Tests ─────────────────────────\n');

// 1. Round-trip: generate + verify
{
  const state   = generateState(FAKE_USER_ID);
  const payload = verifyState(state);
  assert('Round-trip: verifyState returns correct userId', payload.userId === FAKE_USER_ID);
  assert('Round-trip: payload has nonce', typeof payload.nonce === 'string' && payload.nonce.length > 0);
  assert('Round-trip: payload has iat',   typeof payload.iat   === 'number');
}

// 2. State format
{
  const state = generateState(FAKE_USER_ID);
  const parts = state.split('.');
  assert('State has exactly two dot-delimited segments', parts.length === 2);
}

// 3. Two states for the same userId must differ (random nonce)
{
  const s1 = generateState(FAKE_USER_ID);
  const s2 = generateState(FAKE_USER_ID);
  assert('Different nonce each call (replay prevention)', s1 !== s2);
}

// 4. Tampered payload is rejected
{
  const state = generateState(FAKE_USER_ID);
  const [data, hmac] = state.split('.');
  // Flip a char in the payload
  const tampered = data.slice(0, -1) + (data.endsWith('a') ? 'b' : 'a') + '.' + hmac;
  let threw = false;
  try { verifyState(tampered); } catch { threw = true; }
  assert('Tampered payload is rejected', threw);
}

// 5. Tampered HMAC is rejected
{
  const state = generateState(FAKE_USER_ID);
  const [data] = state.split('.');
  const tampered = data + '.invalidsignature';
  let threw = false;
  try { verifyState(tampered); } catch { threw = true; }
  assert('Tampered HMAC is rejected', threw);
}

// 6. Missing state throws
{
  let threw = false;
  try { verifyState(''); } catch { threw = true; }
  assert('Empty state throws', threw);
}

// 7. Expired state throws
{
  // Monkey-patch Date.now to return a timestamp 11 minutes in the past
  const realNow = Date.now;
  Date.now = () => realNow() - (11 * 60 * 1000);
  const state = generateState(FAKE_USER_ID);
  Date.now = realNow; // restore

  let threw = false;
  let msg   = '';
  try { verifyState(state); } catch (e) { threw = true; msg = e.message; }
  assert('Expired state throws', threw);
  assert('Expired error mentions "expired"', msg.toLowerCase().includes('expired'));
}

// 8. State with wrong secret is rejected
{
  const originalSecret = process.env.JWT_SECRET;
  const state = generateState(FAKE_USER_ID);
  process.env.JWT_SECRET = 'different_secret_that_is_at_least_32_chars_long!';
  let threw = false;
  try { verifyState(state); } catch { threw = true; }
  process.env.JWT_SECRET = originalSecret;
  assert('State signed with a different secret is rejected', threw);
}

// ─── Summary ─────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────────────\n`);
process.exit(failed > 0 ? 1 : 0);
