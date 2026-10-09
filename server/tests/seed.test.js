import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import User from '../src/models/User.js';
import { ensureAdmin } from '../src/seed/admin.js';
import { verifyPassword } from '../src/utils/password.js';
import { createTestUser } from './helpers/auth.js';
import { buildTestEnv } from './helpers/app.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';

describe('ensureAdmin', () => {
  const env = buildTestEnv({ ADMIN_PASSWORD: 'First-Admin-Pass-1' });

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);

  it('creates an admin who must change the password at first sign-in', async () => {
    const result = await ensureAdmin(env);

    assert.equal(result.created, true);
    const stored = await User.findOne({ username: 'admin' }).select('+passwordHash');
    assert.equal(stored.role, 'admin');
    assert.equal(stored.mustChangePassword, true);
    assert.notEqual(stored.passwordHash, 'First-Admin-Pass-1');
    assert.equal(await verifyPassword('First-Admin-Pass-1', stored.passwordHash), true);
  });

  it('can be run twice without creating a second admin', async () => {
    await ensureAdmin(env);
    const second = await ensureAdmin(env);

    assert.equal(second.created, false);
    assert.equal(await User.countDocuments({ role: 'admin' }), 1);
  });

  it('does nothing when any admin already exists', async () => {
    await createTestUser({ role: 'admin', username: 'someone-else' });
    const result = await ensureAdmin(env);

    assert.equal(result.created, false);
    assert.equal(await User.countDocuments(), 1);
  });

  it('refuses to run without a password', async () => {
    await assert.rejects(() => ensureAdmin(buildTestEnv()), /ADMIN_PASSWORD/);
  });

  it('refuses a weak password', async () => {
    await assert.rejects(
      () => ensureAdmin(buildTestEnv({ ADMIN_PASSWORD: 'short' })),
      /ADMIN_PASSWORD is too weak/
    );
  });
});
