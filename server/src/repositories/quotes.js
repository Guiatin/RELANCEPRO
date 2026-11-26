const QUOTE_SELECT = `
  SELECT q.id, q.company_id, q.client_id, q.number, q.status, q.issue_date, q.valid_until,
         q.subtotal, q.discount_total, q.tax_total, q.total, q.notes, q.terms,
         q.client_reference, q.client_snapshot, q.issuer_snapshot, q.created_by,
         q.sent_at, q.accepted_at, q.created_at, q.updated_at, q.deleted_at,
         c.name AS client_name,
         (SELECT COUNT(*) FROM quote_items qi
           WHERE qi.company_id = q.company_id AND qi.quote_id = q.id) AS item_count
  FROM quotes q
  JOIN clients c ON c.company_id = q.company_id AND c.id = q.client_id
`;

const ITEM_COLUMNS = `
  id, company_id, quote_id, product_id, position, description, quantity, unit,
  unit_price, discount_rate, tax_rate, tax_exemption_code, tax_exemption_reason,
  line_subtotal, line_discount, line_tax, line_total, created_at, updated_at
`;

const HEADER_COLUMNS = {
  clientId: 'client_id',
  notes: 'notes',
  terms: 'terms',
  clientReference: 'client_reference',
  validUntil: 'valid_until',
  subtotal: 'subtotal',
  discountTotal: 'discount_total',
  taxTotal: 'tax_total',
  total: 'total',
};

function toDateString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);

  return value.toISOString().slice(0, 10);
}

function parseJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapQuote(row) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    clientId: String(row.client_id),
    clientName: row.client_name ?? null,
    number: row.number ?? null,
    status: row.status,
    issueDate: toDateString(row.issue_date),
    validUntil: toDateString(row.valid_until),
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    taxTotal: Number(row.tax_total),
    total: Number(row.total),
    notes: row.notes ?? null,
    terms: row.terms ?? null,
    clientReference: row.client_reference ?? null,
    clientSnapshot: parseJson(row.client_snapshot),
    issuerSnapshot: parseJson(row.issuer_snapshot),
    createdBy: row.created_by === null ? null : String(row.created_by),
    sentAt: row.sent_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
    itemCount: row.item_count === undefined ? undefined : Number(row.item_count),
  };
}

function mapItem(row) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    quoteId: String(row.quote_id),
    productId: row.product_id === null ? null : String(row.product_id),
    position: Number(row.position),
    description: row.description,
    quantity: row.quantity,
    unit: row.unit ?? null,
    unitPrice: Number(row.unit_price),
    discountRate: row.discount_rate,
    taxRate: row.tax_rate,
    taxExemptionCode: row.tax_exemption_code ?? null,
    taxExemptionReason: row.tax_exemption_reason ?? null,
    lineSubtotal: Number(row.line_subtotal),
    lineDiscount: Number(row.line_discount),
    lineTax: Number(row.line_tax),
    lineTotal: Number(row.line_total),
  };
}

function escapeLike(value) {
  return value.replace(/[!%_]/g, '!$&');
}

function toDateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : value;
}

export async function findAllByCompany(conn, companyId, filters = {}) {
  const page = Math.max(1, Math.floor(Number(filters.page)) || 1);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(filters.limit)) || 20));
  const offset = (page - 1) * limit;

  const conditions = ['q.company_id = ?', 'q.deleted_at IS NULL'];
  const params = [companyId];

  if (typeof filters.status === 'string' && filters.status) {
    conditions.push('q.status = ?');
    params.push(filters.status);
  }

  if (typeof filters.client_id === 'string' && filters.client_id) {
    conditions.push('q.client_id = ?');
    params.push(filters.client_id);
  }

  const reference = typeof filters.reference === 'string' ? filters.reference.trim() : '';
  if (reference) {
    conditions.push(`q.client_reference LIKE ? ESCAPE '!'`);
    params.push(`%${escapeLike(reference)}%`);
  }

  if (filters.from) {
    conditions.push('q.issue_date >= ?');
    params.push(toDateOnly(filters.from));
  }

  if (filters.to) {
    conditions.push('q.issue_date <= ?');
    params.push(toDateOnly(filters.to));
  }

  const where = conditions.join(' AND ');

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM quotes q WHERE ${where}`,
    params,
  );

  const [rows] = await conn.execute(
    `${QUOTE_SELECT} WHERE ${where}
     ORDER BY q.created_at DESC, q.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { data: rows.map(mapQuote), total: Number(countRows[0].total) };
}

export async function findById(conn, companyId, quoteId) {
  const [rows] = await conn.execute(
    `${QUOTE_SELECT} WHERE q.company_id = ? AND q.id = ? AND q.deleted_at IS NULL LIMIT 1`,
    [companyId, quoteId],
  );

  if (!rows[0]) return null;

  const [itemRows] = await conn.execute(
    `SELECT ${ITEM_COLUMNS} FROM quote_items
     WHERE company_id = ? AND quote_id = ?
     ORDER BY position ASC, id ASC`,
    [companyId, quoteId],
  );

  return { ...mapQuote(rows[0]), items: itemRows.map(mapItem) };
}

export async function create(conn, companyId, userId, data) {
  const [result] = await conn.execute(
    `INSERT INTO quotes
       (company_id, client_id, status, valid_until, subtotal, discount_total, tax_total, total,
        notes, terms, client_reference, created_by, created_at, updated_at)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [
      companyId,
      data.clientId,
      data.validUntil ?? null,
      data.subtotal,
      data.discountTotal,
      data.taxTotal,
      data.total,
      data.notes ?? null,
      data.terms ?? null,
      data.clientReference ?? null,
      userId,
    ],
  );

  return String(result.insertId);
}

export async function replaceItems(conn, companyId, quoteId, items) {
  await conn.execute('DELETE FROM quote_items WHERE company_id = ? AND quote_id = ?', [
    companyId,
    quoteId,
  ]);

  for (const [index, item] of items.entries()) {
    await conn.execute(
      `INSERT INTO quote_items
         (company_id, quote_id, product_id, position, description, quantity, unit, unit_price,
          discount_rate, tax_rate, tax_exemption_code, tax_exemption_reason,
          line_subtotal, line_discount, line_tax, line_total, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [
        companyId,
        quoteId,
        item.productId ?? null,
        index,
        item.description,
        item.quantity,
        item.unit ?? null,
        item.unitPrice,
        item.discountRate,
        item.taxRate,
        item.taxExemptionCode ?? null,
        item.taxExemptionReason ?? null,
        item.lineSubtotal,
        item.lineDiscount,
        item.lineTax,
        item.lineTotal,
      ],
    );
  }
}

export async function updateHeader(conn, companyId, quoteId, data) {
  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(HEADER_COLUMNS)) {
    if (data[key] === undefined) continue;
    sets.push(`\`${column}\` = ?`);
    params.push(data[key]);
  }

  if (sets.length === 0) return 0;

  const [result] = await conn.execute(
    `UPDATE quotes SET ${sets.join(', ')}, updated_at = UTC_TIMESTAMP()
     WHERE company_id = ? AND id = ? AND status = 'draft' AND deleted_at IS NULL`,
    [...params, companyId, quoteId],
  );

  return result.affectedRows;
}

export async function softDelete(conn, companyId, quoteId) {
  const [result] = await conn.execute(
    `UPDATE quotes SET deleted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
     WHERE company_id = ? AND id = ? AND status = 'draft' AND deleted_at IS NULL`,
    [companyId, quoteId],
  );

  return result.affectedRows > 0;
}

export async function markSent(
  conn,
  companyId,
  quoteId,
  { number, issueDate, validUntil, clientSnapshot, issuerSnapshot },
) {
  const [result] = await conn.execute(
    `UPDATE quotes
     SET number = ?, status = 'sent', issue_date = ?, valid_until = ?, sent_at = UTC_TIMESTAMP(),
         client_snapshot = ?, issuer_snapshot = ?, updated_at = UTC_TIMESTAMP()
     WHERE company_id = ? AND id = ? AND status = 'draft' AND deleted_at IS NULL`,
    [
      number,
      issueDate,
      validUntil,
      JSON.stringify(clientSnapshot),
      JSON.stringify(issuerSnapshot),
      companyId,
      quoteId,
    ],
  );

  return result.affectedRows > 0;
}

export async function updateStatus(conn, companyId, quoteId, { status, acceptedAt = null }) {
  const [result] = await conn.execute(
    `UPDATE quotes SET status = ?, accepted_at = ?, updated_at = UTC_TIMESTAMP()
     WHERE company_id = ? AND id = ? AND status = 'sent' AND deleted_at IS NULL`,
    [status, acceptedAt, companyId, quoteId],
  );

  return result.affectedRows > 0;
}
