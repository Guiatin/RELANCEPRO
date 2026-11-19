import { Router } from 'express';
import * as authController from '../controllers/auth.js';
import { csrfProtect } from '../middlewares/csrf.js';
import { requireActiveUser, requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  loginLimiter,
  passwordLimiter,
  registerLimiter,
  resetLimiter,
} from '../middlewares/rateLimit.js';
import {
  changePasswordSchema,
  loginSchema,
  regenerateRecoveryCodeSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', csrfProtect, authController.refresh);
router.post('/logout', csrfProtect, authController.logout);
router.get('/me', requireAuth, requireActiveUser, authController.me);
router.post(
  '/reset-password',
  resetLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.patch(
  '/password',
  requireAuth,
  requireActiveUser,
  csrfProtect,
  passwordLimiter,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.post(
  '/recovery-code/regenerate',
  requireAuth,
  requireActiveUser,
  csrfProtect,
  passwordLimiter,
  validate(regenerateRecoveryCodeSchema),
  authController.regenerateRecoveryCode,
);

export default router;
