import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  changePasswordSchema,
  createAuthController,
  loginSchema,
} from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';

export function createAuthRoutes({ env, auth }) {
  const router = Router();
  const ctrl = createAuthController({ env });

  // Counts failed attempts only, so a player who signs in fine is never throttled.
  const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: env.loginRateLimitMax,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many sign-in attempts. Try again in a few minutes.' },
  });

  router.post('/login', loginLimiter, validate(loginSchema), ctrl.login);
  router.post('/logout', ctrl.logout);

  // These two stay reachable while a temporary password is still in place.
  router.get('/me', auth.authenticate, ctrl.me);
  router.post(
    '/change-password',
    auth.authenticate,
    validate(changePasswordSchema),
    ctrl.changePassword
  );

  return router;
}
