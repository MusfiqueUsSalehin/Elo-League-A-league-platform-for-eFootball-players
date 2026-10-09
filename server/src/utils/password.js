import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const MAX_BYTES = 72; // bcrypt silently ignores anything beyond 72 bytes

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_BYTES, 'That password is too long');

export const hashPassword = (plain, rounds) => bcrypt.hash(plain, rounds);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// No 0/O, 1/l/I: temporary passwords get read aloud and typed by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** A random temporary password like `kT7m-Qx9w-Rb4e` (12 characters, about 70 bits). */
export function generatePassword() {
  for (;;) {
    const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
    const candidate = [0, 4, 8].map((i) => chars.slice(i, i + 4).join('')).join('-');
    if (passwordSchema.safeParse(candidate).success) return candidate;
  }
}
