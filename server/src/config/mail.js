import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// The same file env.js reads, so mail settings can live in server/.env too.
const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');

function readEnvFile() {
  try {
    return dotenv.parse(readFileSync(ENV_FILE));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

const schema = z.object({
  MAIL_MODE: z.enum(['smtp', 'console', 'off']).optional(),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  MAIL_FROM_NAME: z.string().trim().min(1).max(60).optional(),
  MAIL_FROM_EMAIL: z.string().trim().email().default('no-reply@eloleague.local'),
});

const fail = (problems) => {
  throw new Error(`Invalid mail configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
};

/**
 * How emails leave the app.
 *   smtp    sends through your mail server (set SMTP_HOST)
 *   console writes the email to the log instead (handy while developing)
 *   off     sends nothing; people only get in-app notifications
 * Without MAIL_MODE: smtp when SMTP_HOST is set, otherwise console in development and off in
 * production, so a production server never pretends to send mail it is not sending.
 */
export function loadMailConfig(env, source = { ...readEnvFile(), ...process.env }) {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    fail(result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`));
  }

  const value = result.data;
  const mode = value.MAIL_MODE ?? (value.SMTP_HOST ? 'smtp' : env.isProd ? 'off' : 'console');

  if (mode === 'smtp' && !value.SMTP_HOST) fail(['SMTP_HOST: is required when MAIL_MODE is smtp']);
  if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASS)) {
    fail(['SMTP_USER and SMTP_PASS: set both or neither']);
  }

  return Object.freeze({
    mode,
    smtp:
      mode === 'smtp'
        ? {
            host: value.SMTP_HOST,
            port: value.SMTP_PORT,
            secure: value.SMTP_SECURE === 'true',
            ...(value.SMTP_USER ? { auth: { user: value.SMTP_USER, pass: value.SMTP_PASS } } : {}),
          }
        : null,
    from: { name: value.MAIL_FROM_NAME ?? env.appName, address: value.MAIL_FROM_EMAIL },
  });
}
