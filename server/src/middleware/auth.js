import User from '../models/User.js';
import { COOKIE_NAME, verifyToken } from '../services/token.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const EXPIRED = 'Your session expired. Sign in again.';

export function createAuth({ env }) {
  /** Identifies the caller from the session cookie. Does not check for a pending password change. */
  const authenticate = asyncHandler(async (req, _res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw ApiError.unauthorized();

    let payload;
    try {
      payload = verifyToken(token, env);
    } catch {
      throw ApiError.unauthorized(EXPIRED);
    }

    const user = await User.findById(payload.sub);
    if (!user) throw ApiError.unauthorized(EXPIRED);
    if (!user.isActive) throw ApiError.forbidden('This account is deactivated. Contact the admin.');
    if (user.tokenVersion !== payload.tv) throw ApiError.unauthorized(EXPIRED);

    req.user = user;
    next();
  });

  /** Blocks everything until a temporary password has been replaced. */
  const enforcePasswordChange = (req, _res, next) => {
    if (req.user.mustChangePassword) {
      return next(
        ApiError.forbidden(
          'You need to set a new password before continuing',
          'PASSWORD_CHANGE_REQUIRED'
        )
      );
    }
    next();
  };

  const requireAdmin = (req, _res, next) => {
    if (req.user?.role !== 'admin') return next(ApiError.forbidden('Admin access only'));
    next();
  };

  return {
    authenticate,
    enforcePasswordChange,
    // Use this on everything except the few routes a user can reach before changing their password.
    protect: [authenticate, enforcePasswordChange],
    requireAdmin,
  };
}
