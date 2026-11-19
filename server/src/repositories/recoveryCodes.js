export async function createRecoveryCode(conn, { userId, codeHash }) {
  await conn.execute(
    'INSERT INTO recovery_codes (user_id, code_hash, created_at) VALUES (?, ?, UTC_TIMESTAMP())',
    [userId, codeHash],
  );
}

export async function findActiveRecoveryCodeForUpdate(conn, userId) {
  const [rows] = await conn.execute(
    `SELECT id, code_hash
     FROM recovery_codes
     WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL
     ORDER BY id DESC
     LIMIT 1 FOR UPDATE`,
    [userId],
  );

  if (!rows[0]) return null;

  return { id: String(rows[0].id), codeHash: rows[0].code_hash };
}

export async function markRecoveryCodeUsed(conn, codeId) {
  await conn.execute('UPDATE recovery_codes SET used_at = UTC_TIMESTAMP() WHERE id = ?', [codeId]);
}

export async function revokeActiveRecoveryCodes(conn, userId) {
  await conn.execute(
    `UPDATE recovery_codes
     SET revoked_at = UTC_TIMESTAMP()
     WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
    [userId],
  );
}
