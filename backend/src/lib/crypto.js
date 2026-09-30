/**
 * AES-256-GCM symmetric encryption for sensitive fields (e.g. Google refresh tokens).
 *
 * Env required:
 *   ENCRYPTION_KEY  – 64 hex characters (= 32 bytes).
 *                     Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Ciphertext format (all base64, colon-delimited):
 *   <iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * Why AES-256-GCM?
 *   - Authenticated encryption: any tampering of the ciphertext is detected.
 *   - Random 12-byte IV per encryption call → same plaintext never yields the same output.
 *   - No padding oracle vulnerability (unlike CBC).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12; // 96-bit IV recommended for GCM
const TAG_BYTES  = 16; // 128-bit auth tag (GCM default)

/**
 * Returns the 32-byte Buffer key, validated at call time so the error surface
 * is limited to code paths that actually encrypt/decrypt.
 */
function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts `plaintext` and returns a colon-delimited base64 string.
 * @param {string} plaintext
 * @returns {string}  "<iv>:<tag>:<ciphertext>" (all base64)
 */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;

  const key    = getKey();
  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag(); // must be called after final()

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a value produced by `encrypt()`.
 * @param {string} encryptedValue  "<iv>:<tag>:<ciphertext>" (all base64)
 * @returns {string}
 */
export function decrypt(encryptedValue) {
  if (encryptedValue === null || encryptedValue === undefined) return encryptedValue;

  const parts = String(encryptedValue).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected "<iv>:<tag>:<ciphertext>"');
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const key        = getKey();
  const iv         = Buffer.from(ivB64, 'base64');
  const tag        = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Convenience: re-encrypt a value with a fresh IV (useful on token rotation).
 * @param {string} encryptedValue
 * @returns {string}
 */
export function reEncrypt(encryptedValue) {
  return encrypt(decrypt(encryptedValue));
}
