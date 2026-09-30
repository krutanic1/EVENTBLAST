/**
 * Smoke test for the AES-256-GCM crypto utility.
 * Run with: node scripts/test-crypto.js
 *
 * Requires ENCRYPTION_KEY to be set in the environment (or .env).
 * You can prefix it inline:
 *   ENCRYPTION_KEY=<64-hex-chars> node scripts/test-crypto.js
 */

import 'dotenv/config';
import { encrypt, decrypt, reEncrypt } from '../src/lib/crypto.js';

// ─── Quick-gen a test key if none is set ──────────────────
if (!process.env.ENCRYPTION_KEY) {
  const { randomBytes } = await import('crypto');
  process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
  console.warn(
    `\n⚠️  ENCRYPTION_KEY not set — using ephemeral key for this run:\n   ${process.env.ENCRYPTION_KEY}\n`
  );
}

// ─── Tests ───────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    failed++;
  }
}

console.log('\n── AES-256-GCM Crypto Utility Tests ──────────────────\n');

// 1. Round-trip
{
  const plain = 'ya29.a0AfH6SMBxxxxxxRefreshTokenPlaintext';
  const enc   = encrypt(plain);
  const dec   = decrypt(enc);
  assert('Round-trip encrypt → decrypt', dec === plain);
  assert('Encrypted value is not plaintext', enc !== plain);
  assert('Encrypted format has 3 colon-delimited parts', enc.split(':').length === 3);
}

// 2. Uniqueness (same plaintext → different ciphertext each time)
{
  const plain = 'same-token-every-time';
  const enc1  = encrypt(plain);
  const enc2  = encrypt(plain);
  assert('Same plaintext produces different ciphertext (random IV)', enc1 !== enc2);
  assert('Both decrypt to the same plaintext', decrypt(enc1) === decrypt(enc2));
}

// 3. Tamper detection (GCM auth tag)
{
  const plain = 'tamper-test-token';
  const enc   = encrypt(plain);
  const parts = enc.split(':');
  // Corrupt a byte in the ciphertext part
  const corruptedCiphertext = Buffer.from(parts[2], 'base64');
  corruptedCiphertext[0] ^= 0xff;
  const tampered = [parts[0], parts[1], corruptedCiphertext.toString('base64')].join(':');

  let threw = false;
  try { decrypt(tampered); } catch { threw = true; }
  assert('Tampered ciphertext throws on decrypt (auth tag mismatch)', threw);
}

// 4. reEncrypt
{
  const plain   = 'rotate-me-token';
  const enc1    = encrypt(plain);
  const enc2    = reEncrypt(enc1);
  assert('reEncrypt produces a different ciphertext',   enc1 !== enc2);
  assert('reEncrypt decrypts to the original plaintext', decrypt(enc2) === plain);
}

// 5. Null passthrough
{
  assert('encrypt(null) returns null', encrypt(null) === null);
  assert('decrypt(null) returns null', decrypt(null) === null);
}

// ─── Summary ─────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────────────\n`);
process.exit(failed > 0 ? 1 : 0);
