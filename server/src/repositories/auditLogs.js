export async function createAuditLog(
  conn,
  {
    companyId = null,
    userId = null,
    action,
    entityType,
    entityId = null,
    metadata = null,
    ip = null,
  },
) {
  await conn.execute(
    `INSERT INTO audit_logs
       (company_id, user_id, action, entity_type, entity_id, metadata, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [
      companyId,
      userId,
      action,
      entityType,
      entityId,
      metadata === null ? null : JSON.stringify(metadata),
      ip,
    ],
  );
}
