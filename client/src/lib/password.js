// These rules mirror the server's password policy. The server is the authority;
// checking here only saves a round trip and gives the user a clearer message.

export const PASSWORD_HINT = 'At least 10 characters, with a letter and a number';

const MAX_BYTES = 72; // the hashing algorithm ignores anything beyond this

export function validatePassword(value) {
  const problems = [];
  if (value.length < 10) problems.push('Use at least 10 characters');
  if (!/[A-Za-z]/.test(value)) problems.push('Include at least one letter');
  if (!/\d/.test(value)) problems.push('Include at least one number');
  if (new TextEncoder().encode(value).length > MAX_BYTES)
    problems.push('That password is too long');
  return problems;
}
