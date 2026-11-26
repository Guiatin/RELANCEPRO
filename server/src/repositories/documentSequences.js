export async function nextSequenceValue(conn, companyId, docType, period) {
  await conn.execute(
    `INSERT INTO document_sequences (company_id, doc_type, period, last_value)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE last_value = last_value + 1`,
    [companyId, docType, period],
  );

  const [rows] = await conn.execute(
    `SELECT last_value FROM document_sequences
     WHERE company_id = ? AND doc_type = ? AND period = ? LIMIT 1`,
    [companyId, docType, period],
  );

  return Number(rows[0].last_value);
}

export function formatDocumentNumber(prefix, period, value) {
  return `${prefix}-${period}-${String(value).padStart(4, '0')}`;
}
