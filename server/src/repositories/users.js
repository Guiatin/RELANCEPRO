function mapUser(row, { withPassword = false } = {}) {
  const user = {
    id: String(row.id),
    companyId: String(row.company_id),
    companyName: row.company_name ?? null,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    deletedAt: row.deleted_at ?? null,
  };

  if (withPassword) {
    user.passwordHash = row.password_hash;
  }

  return user;
}

const USER_COLUMNS = `
  u.id, u.company_id, u.full_name, u.email, u.role, u.is_active, u.deleted_at,
  c.name AS company_name
`;

const USER_FROM = 'FROM users u JOIN companies c ON c.id = u.company_id';

export async function createUser(conn, { companyId, fullName, email, passwordHash }) {
  await conn.execute(
    `INSERT INTO users (company_id, full_name, email, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'owner', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [companyId, fullName, email, passwordHash],
  );

  const [rows] = await conn.execute('SELECT LAST_INSERT_ID() AS id');

  return String(rows[0].id);
}

export async function findByEmail(conn, email) {
  const [rows] = await conn.execute(
    `SELECT ${USER_COLUMNS}, u.password_hash ${USER_FROM} WHERE u.email = ? LIMIT 1`,
    [email],
  );

  return rows[0] ? mapUser(rows[0], { withPassword: true }) : null;
}

export async function findActiveUser(conn, { userId, companyId }) {
  const [rows] = await conn.execute(
    `SELECT ${USER_COLUMNS} ${USER_FROM}
     WHERE u.id = ? AND u.company_id = ? AND u.is_active = 1 AND u.deleted_at IS NULL LIMIT 1`,
    [userId, companyId],
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findActiveUserByIdForUpdate(conn, userId) {
  const [rows] = await conn.execute(
    `SELECT ${USER_COLUMNS} ${USER_FROM}
     WHERE u.id = ? AND u.is_active = 1 AND u.deleted_at IS NULL LIMIT 1 FOR UPDATE`,
    [userId],
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findActiveUserWithPassword(conn, { userId, companyId }) {
  const [rows] = await conn.execute(
    `SELECT ${USER_COLUMNS}, u.password_hash ${USER_FROM}
     WHERE u.id = ? AND u.company_id = ? AND u.is_active = 1 AND u.deleted_at IS NULL LIMIT 1`,
    [userId, companyId],
  );

  return rows[0] ? mapUser(rows[0], { withPassword: true }) : null;
}

export async function updatePassword(conn, userId, passwordHash) {
  await conn.execute(
    'UPDATE users SET password_hash = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?',
    [passwordHash, userId],
  );
}

export async function countActiveOwners(conn, companyId) {
  const [rows] = await conn.execute(
    "SELECT COUNT(*) AS total FROM users WHERE company_id = ? AND role = 'owner' AND is_active = 1 AND deleted_at IS NULL",
    [companyId],
  );

  return Number(rows[0].total);
}
