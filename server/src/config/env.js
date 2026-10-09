import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/elo_league';
// Only ever used outside production, so a missing secret cannot reach a real deployment.
const DEV_JWT_SECRET = 'development-only-secret-never-use-in-production';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    APP_NAME: z.string().min(1).default('Elo League'),
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    TIMEZONE: z.string().min(1).default('Asia/Dhaka'),
    MONGO_URI: z.string().min(1).optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    JWT_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
    JWT_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(20),

    ADMIN_NAME: z.string().trim().min(2).max(60).optional(),
    ADMIN_USERNAME: z
      .string()
      .trim()
      .regex(/^[a-z0-9._-]{3,30}$/i, 'use 3-30 letters, numbers, dots, dashes or underscores')
      .optional(),
    ADMIN_EMAIL: z.string().trim().email().optional(),
    ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    const require = (path, message) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (!value.MONGO_URI) require('MONGO_URI', 'is required in production');
    if (!value.JWT_SECRET) require('JWT_SECRET', 'is required in production');
    if (value.BCRYPT_ROUNDS < 10) require('BCRYPT_ROUNDS', 'must be at least 10 in production');
  });

function readEnvFile() {
  try {
    return dotenv.parse(readFileSync(ENV_FILE));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

/**
 * Validates configuration and returns a frozen config object.
 * Real environment variables win over values in server/.env.
 * Throws one readable error listing every problem, so a bad deploy fails at boot.
 * Never log this object: it holds the JWT secret and the first admin's password.
 */
export function loadEnv(source = { ...readEnvFile(), ...process.env }) {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = schema.safeParse(cleaned);

  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`
    );
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }

  const value = result.data;
  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    isProd: value.NODE_ENV === 'production',
    isDev: value.NODE_ENV === 'development',
    isTest: value.NODE_ENV === 'test',
    port: value.PORT,
    appName: value.APP_NAME,
    clientUrl: new URL(value.CLIENT_URL).origin,
    timezone: value.TIMEZONE,
    mongoUri: value.MONGO_URI ?? DEFAULT_MONGO_URI,
    logLevel: value.LOG_LEVEL,

    jwtSecret: value.JWT_SECRET ?? DEV_JWT_SECRET,
    jwtExpiresDays: value.JWT_EXPIRES_DAYS,
    bcryptRounds: value.BCRYPT_ROUNDS,
    loginRateLimitMax: value.LOGIN_RATE_LIMIT_MAX,

    admin: {
      name: value.ADMIN_NAME ?? 'League Admin',
      username: (value.ADMIN_USERNAME ?? 'admin').toLowerCase(),
      email: (value.ADMIN_EMAIL ?? 'admin@eloleague.local').toLowerCase(),
      password: value.ADMIN_PASSWORD,
    },
  });
}
