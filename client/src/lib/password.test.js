import { describe, expect, it } from 'vitest';
import { validatePassword } from './password.js';

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    expect(validatePassword('Correct-Horse-42')).toEqual([]);
  });

  it('asks for at least 10 characters', () => {
    expect(validatePassword('Ab1')).toContain('Use at least 10 characters');
  });

  it('asks for a letter', () => {
    expect(validatePassword('1234567890123')).toEqual(['Include at least one letter']);
  });

  it('asks for a number', () => {
    expect(validatePassword('abcdefghijkl')).toEqual(['Include at least one number']);
  });

  it('rejects a password longer than the hashing limit', () => {
    expect(validatePassword('a1'.repeat(40))).toEqual(['That password is too long']);
  });

  it('counts bytes, not characters', () => {
    // 38 characters, but 74 bytes once encoded
    expect(validatePassword(`a1${'é'.repeat(36)}`)).toEqual(['That password is too long']);
  });

  it('reports every problem at once', () => {
    expect(validatePassword('')).toHaveLength(3);
  });
});
