import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generatePassword,
  hashPassword,
  passwordSchema,
  verifyPassword,
} from '../src/utils/password.js';

describe('passwordSchema', () => {
  it('accepts a strong password', () => {
    assert.equal(passwordSchema.safeParse('Correct-Horse-42').success, true);
  });

  it('rejects short passwords', () => {
    assert.equal(passwordSchema.safeParse('Ab1').success, false);
  });

  it('requires a letter and a number', () => {
    assert.equal(passwordSchema.safeParse('abcdefghijkl').success, false);
    assert.equal(passwordSchema.safeParse('1234567890123').success, false);
  });

  it('rejects passwords longer than bcrypt can use', () => {
    assert.equal(passwordSchema.safeParse('a1'.repeat(40)).success, false);
  });
});

describe('generatePassword', () => {
  it('always meets the policy and never repeats', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const password = generatePassword();
      assert.equal(passwordSchema.safeParse(password).success, true);
      seen.add(password);
    }
    assert.equal(seen.size, 50);
  });
});

describe('hashing', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('Correct-Horse-42', 4);
    assert.notEqual(hash, 'Correct-Horse-42');
    assert.equal(await verifyPassword('Correct-Horse-42', hash), true);
    assert.equal(await verifyPassword('Wrong-Horse-42', hash), false);
  });
});
