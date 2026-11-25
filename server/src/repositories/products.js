const PRODUCT_COLUMNS = `
  id, company_id, type, name, description, unit, unit_price, tax_rate,
  is_active, created_at, updated_at, deleted_at
`;

const UPDATABLE_COLUMNS = {
  type: 'type',
  name: 'name',
  description: 'description',
  unit: 'unit',
  unitPrice: 'unit_price',
  taxRate: 'tax_rate',
  isActive: 'is_active',
};

function mapProduct(row) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    type: row.type,
    name: row.name,
    description: row.description ?? null,
    unit: row.unit ?? null,
    unitPrice: Number(row.unit_price),
    taxRate: row.tax_rate,
    isActive: Boolean(row.is_active),
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

function toColumnValue(key, value) {
  if (key === 'isActive') return value ? 1 : 0;
  if (key === 'unitPrice') return String(value);
  return value;
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
        OR description LIKE ? ESCAPE '!')`,
    );
    params.push(pattern, pattern);
  }

  const type = typeof filters.type === 'string' ? filters.type.trim() : '';
  if (type) {
    conditions.push('`type` = ?');
    params.push(type);
  }

  const active = toActiveFlag(filters.active);
  if (active !== null) {
    conditions.push('is_active = ?');
    params.push(active);
  }

  const where = conditions.join(' AND ');

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM products WHERE ${where}`,
    params,
  );

  const [rows] = await conn.execute(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE ${where}
     ORDER BY name ASC, id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { data: rows.map(mapProduct), total: Number(countRows[0].total) };
}

export async function findById(conn, companyId, productId) {
  const [rows] = await conn.execute(
    `SELECT ${PRODUCT_COLUMNS} FROM products
     WHERE company_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1`,
    [companyId, productId],
  );

  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function create(conn, companyId, data) {
  const columns = ['company_id', 'type', 'name'];
  const values = [companyId, data.type, data.name];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (key === 'type' || key === 'name') continue;
    if (data[key] === undefined) continue;
    columns.push(column);
    values.push(toColumnValue(key, data[key]));
  }

  const [result] = await conn.execute(
    `INSERT INTO products (${columns.join(', ')}, created_at, updated_at)
     VALUES (${columns.map(() => '?').join(', ')}, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    values,
  );

  return String(result.insertId);
}

export async function update(conn, companyId, productId, data) {
  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (data[key] === undefined) continue;
    sets.push(`\`${column}\` = ?`);
    params.push(toColumnValue(key, data[key]));
  }

  if (sets.length === 0) {
    return { product: await findById(conn, companyId, productId), updated: false };
  }

  const [result] = await conn.execute(
    `UPDATE products SET ${sets.join(', ')}
     WHERE company_id = ? AND id = ? AND deleted_at IS NULL`,
    [...params, companyId, productId],
  );

  return { product: await findById(conn, companyId, productId), updated: result.changedRows > 0 };
}

export async function softDelete(conn, companyId, productId) {
  const [result] = await conn.execute(
    `UPDATE products SET deleted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
     WHERE company_id = ? AND id = ? AND deleted_at IS NULL`,
    [companyId, productId],
  );

  return result.affectedRows > 0;
}
