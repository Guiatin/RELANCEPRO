import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { BCRYPT_ROUNDS, REFRESH_TOKEN_TTL_MS } from '../config/constants.js';
import {
  createRecoveryCode as insertRecoveryCode,
  findActiveRecoveryCodeForUpdate,
  markRecoveryCodeUsed,
  revokeActiveRecoveryCodes,
} from '../repositories/recoveryCodes.js';
import {
  createSession as insertSession,
  findByTokenHash,
  revokeAllForUser,
  revokeSession,
  revokeSessionWithReplacement,
} from '../repositories/sessions.js';
import {
  createUser,
  findActiveUserByIdForUpdate,
  findActiveUserWithPassword,
  findByEmail,
  updatePassword,
} from '../repositories/users.js';
import { createCompany } from '../repositories/companies.js';
import { createAuditLog } from '../repositories/auditLogs.js';
import { conflict, forbidden, unauthenticated } from '../utils/errors.js';
import {
  formatRecoveryCode,
  generateCsrfToken,
  generateRecoveryCode,
  generateSessionToken,
  normalizeRecoveryCode,
  safeEqualHex,
  sha256,
} from '../utils/crypto.js';
import { signAccessToken } from '../utils/jwt.js';

const DUMMY_PASSWORD_HASH = '$2b$12$uiLkZbtPFP9sGkO1HPCfIuTjjXYAPpMYomorPcXyx.T9UXg0PruLq';

function publicUser(user) {
  return {
    id: user.id,
    full_name: user.fullName,
    email: user.email,
    role: user.role,
  };
}

function buildAuthResult({ user, company, refreshToken, sessionId, recoveryCode }) {
  return {
    user: publicUser(user),
    company: { id: company.id, name: company.name },
    accessToken: signAccessToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      sessionId,
    }),
    refreshToken,
    csrfToken: generateCsrfToken(),
    recoveryCode,
  };
}

function requestMeta(context) {
  return {
    ip: context.ip ?? null,
    userAgent: context.userAgent ? context.userAgent.slice(0, 255) : null,
  };
}

async function createSessionToken(conn, { userId, context }) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const meta = requestMeta(context);

  const id = await insertSession(conn, {
    userId,
    tokenHash: sha256(token),
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { id, token };
}

async function recordAudit(conn, entry) {
  await createAuditLog(conn, entry);
}

export async function register(input, context) {
  const existing = await findByEmail(pool, input.email);

  if (existing) {
    throw conflict('Un compte existe déjà avec cet email.');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const rawRecoveryCode = generateRecoveryCode();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const company = await createCompany(conn, { name: input.company_name });
    const userId = await createUser(conn, {
      companyId: company.id,
      fullName: input.full_name,
      email: input.email,
      passwordHash,
    });

    await insertRecoveryCode(conn, {
      userId,
      codeHash: sha256(normalizeRecoveryCode(rawRecoveryCode)),
    });

    const session = await createSessionToken(conn, { userId, context });

    await recordAudit(conn, {
      companyId: company.id,
      userId,
      action: 'auth.register',
      entityType: 'user',
      entityId: userId,
      metadata: { email: input.email },
      ip: context.ip ?? null,
    });

    await conn.commit();

    const user = {
      id: userId,
      companyId: company.id,
      companyName: company.name,
      fullName: input.full_name,
      email: input.email,
      role: 'owner',
    };

    return buildAuthResult({
      user,
      company,
      refreshToken: session.token,
      sessionId: session.id,
      recoveryCode: formatRecoveryCode(rawRecoveryCode),
    });
  } catch (error) {
    await conn.rollback().catch(() => undefined);

    if (error?.code === 'ER_DUP_ENTRY') {
      throw conflict('Un compte existe déjà avec cet email.');
    }

    throw error;
  } finally {
    conn.release();
  }
}

export async function login(input, context) {
  const user = await findByEmail(pool, input.email);
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches || !user.isActive || user.deletedAt) {
    await recordAudit(pool, {
      companyId: user?.companyId ?? null,
      userId: user?.id ?? null,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: user?.id ?? null,
      metadata: { email: input.email },
      ip: context.ip ?? null,
    });

    throw unauthenticated('Email ou mot de passe incorrect.');
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const session = await createSessionToken(conn, { userId: user.id, context });

    await recordAudit(conn, {
      companyId: user.companyId,
      userId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ip: context.ip ?? null,
    });

    await conn.commit();

    return buildAuthResult({
      user,
      company: { id: user.companyId, name: user.companyName },
      refreshToken: session.token,
      sessionId: session.id,
    });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

export async function refresh(context) {
  if (!context.refreshToken) {
    throw unauthenticated('Session expirée ou invalide.');
  }

  const tokenHash = sha256(context.refreshToken);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const session = await findByTokenHash(conn, tokenHash, { forUpdate: true });

    if (!session) {
      throw unauthenticated('Session expirée ou invalide.');
    }

    if (session.revokedAt) {
      if (session.replacedById) {
        await revokeAllForUser(conn, session.userId);
        await recordAudit(conn, {
          companyId: session.companyId,
          userId: session.userId,
          action: 'auth.refresh_reuse',
          entityType: 'session',
          entityId: session.id,
          ip: context.ip ?? null,
        });
        await conn.commit();
      }

      throw unauthenticated('Session expirée ou invalide.');
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw unauthenticated('Session expirée ou invalide.');
    }

    if (!session.isUserActive || session.isUserDeleted) {
      throw unauthenticated('Session expirée ou invalide.');
    }

    const user = await findActiveUserByIdForUpdate(conn, session.userId);

    if (!user) {
      throw unauthenticated('Session expirée ou invalide.');
    }

    const newSession = await createSessionToken(conn, {
      userId: user.id,
      context,
    });

    await revokeSessionWithReplacement(conn, session.id, newSession.id);

    await conn.commit();

    return buildAuthResult({
      user,
      company: { id: user.companyId, name: user.companyName },
      refreshToken: newSession.token,
      sessionId: newSession.id,
    });
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

export async function logout(context) {
  if (!context.refreshToken) {
    return;
  }

  const tokenHash = sha256(context.refreshToken);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const session = await findByTokenHash(conn, tokenHash, { forUpdate: true });

    if (!session) {
      await conn.rollback();
      return;
    }

    if (!session.revokedAt) {
      await revokeSession(conn, session.id);
      await recordAudit(conn, {
        companyId: session.companyId,
        userId: session.userId,
        action: 'auth.logout',
        entityType: 'session',
        entityId: session.id,
        ip: context.ip ?? null,
      });
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

export async function resetPassword(input, context) {
  const user = await findByEmail(pool, input.email);
  const submittedHash = sha256(input.recovery_code);
  const newPasswordHash = await bcrypt.hash(input.new_password, BCRYPT_ROUNDS);
  const rawRecoveryCode = generateRecoveryCode();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const activeCode = user ? await findActiveRecoveryCodeForUpdate(conn, user.id) : null;
    const codeMatches = activeCode ? safeEqualHex(activeCode.codeHash, submittedHash) : false;

    if (!user || !user.isActive || user.deletedAt || !activeCode || !codeMatches) {
      await conn.rollback();

      await recordAudit(pool, {
        companyId: user?.companyId ?? null,
        userId: user?.id ?? null,
        action: 'auth.password_reset_failed',
        entityType: 'user',
        entityId: user?.id ?? null,
        metadata: { email: input.email },
        ip: context.ip ?? null,
      });

      throw unauthenticated('Email ou code de récupération invalide.');
    }

    const lockedUser = await findActiveUserByIdForUpdate(conn, user.id);

    if (!lockedUser) {
      throw unauthenticated('Email ou code de récupération invalide.');
    }

    await markRecoveryCodeUsed(conn, activeCode.id);
    await revokeActiveRecoveryCodes(conn, user.id);
    await updatePassword(conn, user.id, newPasswordHash);
    await revokeAllForUser(conn, user.id);
    await insertRecoveryCode(conn, {
      userId: user.id,
      codeHash: sha256(normalizeRecoveryCode(rawRecoveryCode)),
    });

    await recordAudit(conn, {
      companyId: user.companyId,
      userId: user.id,
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: user.id,
      metadata: { recovery_code_rotated: true },
      ip: context.ip ?? null,
    });

    await conn.commit();

    return { recoveryCode: formatRecoveryCode(rawRecoveryCode) };
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

export async function changePassword(input, context) {
  const user = await findActiveUserWithPassword(pool, {
    userId: context.user.id,
    companyId: context.user.companyId,
  });

  if (!user) {
    throw unauthenticated('Session expirée ou invalide.');
  }

  const passwordMatches = await bcrypt.compare(input.current_password, user.passwordHash);

  if (!passwordMatches) {
    await recordAudit(pool, {
      companyId: user.companyId,
      userId: user.id,
      action: 'auth.password_change_failed',
      entityType: 'user',
      entityId: user.id,
      ip: context.ip ?? null,
    });

    throw forbidden('Mot de passe actuel incorrect.');
  }

  const passwordHash = await bcrypt.hash(input.new_password, BCRYPT_ROUNDS);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const currentSession = context.refreshToken
      ? await findByTokenHash(conn, sha256(context.refreshToken))
      : null;
    const keepSessionId =
      currentSession && currentSession.userId === user.id ? currentSession.id : null;

    await updatePassword(conn, user.id, passwordHash);
    await revokeAllForUser(conn, user.id, { exceptSessionId: keepSessionId });

    await recordAudit(conn, {
      companyId: user.companyId,
      userId: user.id,
      action: 'auth.password_change',
      entityType: 'user',
      entityId: user.id,
      ip: context.ip ?? null,
    });

    await conn.commit();

    return { updated: true };
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

export async function regenerateRecoveryCode(input, context) {
  const user = await findActiveUserWithPassword(pool, {
    userId: context.user.id,
    companyId: context.user.companyId,
  });

  if (!user) {
    throw unauthenticated('Session expirée ou invalide.');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    await recordAudit(pool, {
      companyId: user.companyId,
      userId: user.id,
      action: 'auth.recovery_code_regenerate_failed',
      entityType: 'user',
      entityId: user.id,
      ip: context.ip ?? null,
    });

    throw forbidden('Mot de passe actuel incorrect.');
  }

  const rawRecoveryCode = generateRecoveryCode();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await revokeActiveRecoveryCodes(conn, user.id);
    await insertRecoveryCode(conn, {
      userId: user.id,
      codeHash: sha256(normalizeRecoveryCode(rawRecoveryCode)),
    });

    await recordAudit(conn, {
      companyId: user.companyId,
      userId: user.id,
      action: 'auth.recovery_code_regenerate',
      entityType: 'user',
      entityId: user.id,
      ip: context.ip ?? null,
    });

    await conn.commit();

    return { recoveryCode: formatRecoveryCode(rawRecoveryCode) };
  } catch (error) {
    await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

export function getSessionUser(user) {
  return {
    user: publicUser(user),
    company: { id: user.companyId, name: user.companyName },
  };
}
