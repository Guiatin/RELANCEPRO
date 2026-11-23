const CLIENT_COLUMNS = `
  id, company_id, name, contact_name, email, phone, whatsapp, address, city, notes,
  is_active, created_by, created_at, updated_at, deleted_at
`;

const UPDATABLE_COLUMNS = {
  name: 'name',
  contactName: 'contact_name',
  email: 'email',
  phone: 'phone',
  whatsapp: 'whatsapp',
  address: 'address',
  city: 'city',
  notes: 'notes',
  isActive: 'is_active',
};

function mapClient(row) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    name: row.name,
    contactName: row.contact_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    notes: row.notes ?? null,
    isActive: Boolean(row.is_active),
    createdBy: row.created_by === null ? null : String(row.created_by),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  };
}

function escapeLike(value) {
  return value.replace(/[!%_]/g, '!$&');
}

function toActiveFlag(active) {
  if (active === undefined || active === null || active === '') return null;
  return active === true || active === 'true' || active === 1 || active === '1' ? 1 : 0;
}

export async function findAllByCompany(conn, companyId, filters = {}) {
  const page = Math.max(1, Math.floor(Number(filters.page)) || 1);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(filters.limit)) || 20));
  const offset = (page - 1) * limit;

  const conditions = ['company_id = ?', 'deleted_at IS NULL'];
  const params = [companyId];

  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    conditions.push(
      `(name LIKE ? ESCAPE '!'
        OR contact_name LIKE ? ESCAPE '!'
        OR email LIKE ? ESCAPE '!'
        OR phone LIKE ? ESCAPE '!')`,
    );
    params.push(pattern, pattern, pattern, pattern);
  }

  const active = toActiveFlag(filters.active);
  if (active !== null) {
    conditions.push('is_active = ?');
    params.push(active);
  }

  const where = conditions.join(' AND ');

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM clients WHERE ${where}`,
    params,
  );

  const [rows] = await conn.execute(
    `SELECT ${CLIENT_COLUMNS} FROM clients WHERE ${where}
     ORDER BY name ASC, id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { data: rows.map(mapClient), total: Number(countRows[0].total) };
}

export async function findById(conn, companyId, clientId) {
  const [rows] = await conn.execute(
    `SELECT ${CLIENT_COLUMNS} FROM clients
     WHERE company_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`,
    [companyId, clientId],
  );

  return rows[0] ? mapClient(rows[0]) : null;
}

export async function create(conn, companyId, userId, data) {
  const [result] = await conn.execute(
    `INSERT INTO clients
       (company_id, name, contact_name, email, phone, whatsapp, address, city, notes,
        is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [
      companyId,
      data.name,
      data.contactName ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.whatsapp ?? null,
      data.address ?? null,
      data.city ?? null,
      data.notes ?? null,
      data.isActive === undefined ? 1 : data.isActive ? 1 : 0,
      userId,
    ],
  );

  return String(result.insertId);
}

export async function update(conn, companyId, clientId, data) {
  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (data[key] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(key === 'isActive' ? (data[key] ? 1 : 0) : data[key]);
  }

  if (sets.length === 0) {
    return { client: await findById(conn, companyId, clientId), updated: false };
  }

  const [result] = await conn.execute(
    `UPDATE clients SET ${sets.join(', ')}, updated_at = UTC_TIMESTAMP()
     WHERE company_id = ? AND id = ? AND deleted_at IS NULL`,
    [...params, companyId, clientId],
  );

  return { client: await findById(conn, companyId, clientId), updated: result.affectedRows > 0 };
}

export async function softDelete(conn, companyId, clientId) {
  const [result] = await conn.execute(
    `UPDATE clients SET deleted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
     WHERE company_id = ? AND id = ? AND deleted_at IS NULL`,
    [companyId, clientId],
  );

  return result.affectedRows > 0;
}
