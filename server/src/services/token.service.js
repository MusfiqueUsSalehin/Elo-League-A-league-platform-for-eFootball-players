import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'elo_token';
const DAY_MS = 24 * 60 * 60 * 1000;

export function signToken(user, env) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${env.jwtExpiresDays}d`,
  });
}

/** Throws when the token is malformed, expired or signed with another secret. */
export function verifyToken(token, env) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
}

function cookieOptions(env) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: env.jwtExpiresDays * DAY_MS,
  };
}

export function setAuthCookie(res, user, env) {
  res.cookie(COOKIE_NAME, signToken(user, env), cookieOptions(env));
}

export function clearAuthCookie(res, env) {
  // maxAge must be left out, or Express sets a future expiry and the cookie survives.
  const { httpOnly, sameSite, secure, path } = cookieOptions(env);
  res.clearCookie(COOKIE_NAME, { httpOnly, sameSite, secure, path });
}
