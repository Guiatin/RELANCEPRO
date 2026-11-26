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

function mapCompanySettings(row) {
  return {
    id: String(row.id),
    name: row.name,
    legalName: row.legal_name ?? null,
    taxId: row.tax_id ?? null,
    tradeRegister: row.trade_register ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    country: row.country,
    currency: row.currency,
    logoPath: row.logo_path ?? null,
    defaultTaxRate: row.default_tax_rate,
    taxExemptionMention: row.tax_exemption_mention ?? null,
    quotePrefix: row.quote_prefix,
    invoicePrefix: row.invoice_prefix,
    paymentTermsDays: Number(row.payment_terms_days),
    documentFooter: row.document_footer ?? null,
  };
}

export async function findSettingsById(conn, companyId) {
  const [rows] = await conn.execute(
    `SELECT id, name, legal_name, tax_id, trade_register, email, phone, address, city, country,
            currency, logo_path, default_tax_rate, tax_exemption_mention, quote_prefix,
            invoice_prefix, payment_terms_days, document_footer
     FROM companies WHERE id = ? LIMIT 1`,
    [companyId],
  );

  return rows[0] ? mapCompanySettings(rows[0]) : null;
}
