export function normalizeRecoveryCode(value) {
  return String(value)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export const RECOVERY_CODE_LENGTH = 20;
export const RECOVERY_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{20}$/;

export function isValidRecoveryCode(value) {
  return RECOVERY_CODE_PATTERN.test(normalizeRecoveryCode(value));
}
