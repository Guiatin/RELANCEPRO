const SESSION_SELECT = `
  SELECT s.id, s.user_id, s.token_hash, s.expires_at, s.revoked_at, s.replaced_by_id,
         u.company_id, u.is_active, u.deleted_at, c.name AS company_name
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  JOIN companies c ON c.id = u.company_id
`;

function mapSession(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    companyId: String(row.company_id),
    companyName: row.company_name,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at ?? null,
    replacedById: row.replaced_by_id === null ? null : String(row.replaced_by_id),
    isUserActive: Boolean(row.is_active),
    isUserDeleted: row.deleted_at !== null,
  };
}

export async function createSession(
  conn,
  { userId, tokenHash, expiresAt, ip = null, userAgent = null, replacedById = null },
) {
  await conn.execute(
    `INSERT INTO sessions
       (user_id, token_hash, expires_at, replaced_by_id, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [userId, tokenHash, expiresAt, replacedById, ip, userAgent],
  );

  const [rows] = await conn.execute('SELECT LAST_INSERT_ID() AS id');

  return String(rows[0].id);
}

export async function findByTokenHash(conn, tokenHash, { forUpdate = false } = {}) {
  const [rows] = await conn.execute(
    `${SESSION_SELECT} WHERE s.token_hash = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [tokenHash],
  );

  return rows[0] ? mapSession(rows[0]) : null;
}

export async function revokeSession(conn, sessionId) {
  await conn.execute(
    'UPDATE sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL',
    [sessionId],
  );
}

export async function revokeSessionWithReplacement(conn, sessionId, replacementId) {
  await conn.execute(
    `UPDATE sessions
     SET revoked_at = UTC_TIMESTAMP(), replaced_by_id = ?
     WHERE id = ? AND revoked_at IS NULL`,
    [replacementId, sessionId],
  );
}

export async function revokeAllForUser(conn, userId, { exceptSessionId = null } = {}) {
  if (exceptSessionId) {
    await conn.execute(
      `UPDATE sessions
       SET revoked_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND revoked_at IS NULL AND id <> ?`,
      [userId, exceptSessionId],
    );
    return;
  }

  await conn.execute(
    'UPDATE sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL',
    [userId],
  );
}
