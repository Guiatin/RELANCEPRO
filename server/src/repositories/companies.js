export async function createCompany(conn, { name }) {
  await conn.execute(
    'INSERT INTO companies (name, created_at, updated_at) VALUES (?, UTC_TIMESTAMP(), UTC_TIMESTAMP())',
    [name],
  );

  const [rows] = await conn.execute('SELECT LAST_INSERT_ID() AS id');

  return { id: String(rows[0].id), name };
}

export async function findCompanyById(conn, companyId) {
  const [rows] = await conn.execute('SELECT id, name FROM companies WHERE id = ? LIMIT 1', [
    companyId,
  ]);

  if (!rows[0]) return null;

  return { id: String(rows[0].id), name: rows[0].name };
}
