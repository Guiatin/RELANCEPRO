import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CROCKFORD_PATTERN = /^[0-9A-HJKMNP-TV-Z]{20}$/;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function generateSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function generateCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function generateRecoveryCode() {
  const bytes = randomBytes(20);
  let code = '';

  for (const byte of bytes) {
    code += CROCKFORD_ALPHABET[byte % 32];
  }

  return code;
}

export function normalizeRecoveryCode(value) {
  return String(value)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function isValidRecoveryCode(value) {
  return CROCKFORD_PATTERN.test(normalizeRecoveryCode(value));
}

export function formatRecoveryCode(value) {
  return normalizeRecoveryCode(value).replace(/(.{5})(?=.)/g, '$1-');
}

export function safeEqualHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;

  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}
