import * as authService from '../services/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  clearAuthCookies,
  readRefreshToken,
  setAccessCookie,
  setCsrfCookie,
  setRefreshCookie,
} from '../utils/authCookies.js';

function requestContext(req) {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    refreshToken: readRefreshToken(req),
    user: req.user,
  };
}

function applySessionCookies(res, result) {
  setAccessCookie(res, result.accessToken);
  setRefreshCookie(res, result.refreshToken);
  setCsrfCookie(res, result.csrfToken);
}

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, requestContext(req));

  applySessionCookies(res, result);

  res.status(201).json({
    data: {
      user: result.user,
      company: result.company,
      recovery_code: result.recoveryCode,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, requestContext(req));

  applySessionCookies(res, result);

  res.json({
    data: {
      user: result.user,
      company: result.company,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(requestContext(req));

  applySessionCookies(res, result);

  res.json({
    data: {
      user: result.user,
      company: result.company,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(requestContext(req));

  clearAuthCookies(res);
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => {
  res.json({ data: authService.getSessionUser(req.user) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body, requestContext(req));

  clearAuthCookies(res);

  res.json({
    data: {
      recovery_code: result.recoveryCode,
    },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.body, requestContext(req));

  res.json({ data: result });
});

export const regenerateRecoveryCode = asyncHandler(async (req, res) => {
  const result = await authService.regenerateRecoveryCode(req.body, requestContext(req));

  res.json({
    data: {
      recovery_code: result.recoveryCode,
    },
  });
});
