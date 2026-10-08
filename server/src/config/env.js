import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/elo_league';

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
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && !value.MONGO_URI) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGO_URI'],
        message: 'is required in production',
      });
    }
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
 * Validates configuration and returns a frozen, typed-ish object.
 * Real environment variables win over values in server/.env.
 * Throws one readable error listing every problem, so a bad deploy fails at boot.
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
  });
}
