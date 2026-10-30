import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import Tournament from '../src/models/Tournament.js';
import TournamentEntry from '../src/models/TournamentEntry.js';
import { createTestUser, loginAgent } from './helpers/auth.js';
import { buildTestApp } from './helpers/app.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';

describe('tournaments', () => {
  const { app } = buildTestApp();
  let admin;
  let rahim;
  let adminAgent;
  let playerAgent;

  const cup = { name: 'Winter Cup', format: 'knockout', maxTeams: 8 };
  const create = (overrides = {}) =>
    adminAgent.post('/api/tournaments').send({ ...cup, ...overrides });
  const make = (overrides = {}) =>
    Tournament.create({
      createdBy: admin._id,
      name: 'Spring League',
      format: 'league',
      maxTeams: 8,
      ...overrides,
    });
  const enter = (tournament, status = 'approved') =>
    TournamentEntry.create({
      tournament: tournament._id,
      team: new mongoose.Types.ObjectId(),
      owner: rahim._id,
      status,
    });

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);
  beforeEach(async () => {
    admin = await createTestUser({ role: 'admin', username: 'boss' });
    rahim = await createTestUser({ username: 'rahim' });
    adminAgent = await loginAgent(app, 'boss');
    playerAgent = await loginAgent(app, 'rahim');
  });

  describe('access', () => {
    it('requires a session', async () => {
      assert.equal((await request(app).get('/api/tournaments')).status, 401);
    });

    it('lets only admins change anything', async () => {
      const t = await make();
      assert.equal((await playerAgent.post('/api/tournaments').send(cup)).status, 403);
      assert.equal(
        (await playerAgent.patch(`/api/tournaments/${t.id}`).send({ name: 'Mine' })).status,
        403
      );
      assert.equal(
        (await playerAgent.post(`/api/tournaments/${t.id}/status`).send({ status: 'registration' }))
          .status,
        403
      );
      assert.equal((await playerAgent.delete(`/api/tournaments/${t.id}`)).status, 403);
    });
  });

  describe('POST /api/tournaments', () => {
    it('creates a draft with sensible defaults', async () => {
      const res = await create();

      assert.equal(res.status, 201);
      const { tournament } = res.body;
      assert.equal(tournament.name, 'Winter Cup');
      assert.equal(tournament.status, 'draft');
      assert.equal(tournament.legs, 1);
      assert.equal(tournament.requiresApproval, true);
      assert.equal(tournament.createdBy.username, 'boss');
      assert.deepEqual(tournament.entries, { approved: 0, pending: 0 });
      assert.equal(tournament.nameKey, undefined);
    });

    it('accepts a league played home and away, and dates', async () => {
      const res = await create({
        format: 'league',
        legs: 2,
        registrationDeadline: '2026-11-01T00:00:00.000Z',
        startsAt: '2026-11-10T00:00:00.000Z',
        requiresApproval: false,
        description: 'Everyone plays everyone twice.',
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.tournament.legs, 2);
      assert.equal(res.body.tournament.registrationDeadline, '2026-11-01T00:00:00.000Z');
      assert.equal(res.body.tournament.requiresApproval, false);
    });

    it('rejects a two-legged knockout cup', async () => {
      const res = await create({ legs: 2 });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes('one leg')));
    });

    it('rejects registration closing after the start', async () => {
      const res = await create({
        registrationDeadline: '2026-12-01T00:00:00.000Z',
        startsAt: '2026-11-01T00:00:00.000Z',
      });
      assert.equal(res.status, 400);
    });

    it('rejects bad names, formats and sizes', async () => {
      assert.equal((await create({ name: 'X' })).status, 400);
      assert.equal((await create({ format: 'swiss' })).status, 400);
      assert.equal((await create({ maxTeams: 1 })).status, 400);
      assert.equal((await create({ maxTeams: 65 })).status, 400);
      assert.equal((await create({ maxTeams: 8.5 })).status, 400);
      assert.equal((await create({ registrationDeadline: 'soon' })).status, 400);
    });

    it('ignores fields a caller must not set', async () => {
      const res = await create({ status: 'active', createdBy: rahim.id });

      assert.equal(res.body.tournament.status, 'draft');
      assert.equal(res.body.tournament.createdBy.username, 'boss');
    });

    it('refuses the same name twice, whatever the letter case', async () => {
      await create();
      const res = await create({ name: 'WINTER CUP' });

      assert.equal(res.status, 409);
      assert.equal(res.body.message, 'A competition with that name already exists');
    });
  });

  describe('GET /api/tournaments', () => {
    beforeEach(async () => {
      await make({ name: 'Draft Cup', status: 'draft' });
      const open = await make({ name: 'Open League', status: 'registration' });
      await make({ name: 'Old Cup', format: 'knockout', status: 'completed' });
      await enter(open);
      await enter(open, 'pending');
      await enter(open, 'rejected');
    });

    it('shows drafts to admins only', async () => {
      const admins = await adminAgent.get('/api/tournaments');
      const players = await playerAgent.get('/api/tournaments');

      assert.equal(admins.body.total, 3);
      assert.deepEqual(players.body.items.map((t) => t.name).sort(), ['Old Cup', 'Open League']);
      assert.equal(
        (await playerAgent.get('/api/tournaments').query({ status: 'draft' })).body.total,
        0
      );
    });

    it('counts the teams that entered, not the ones turned away', async () => {
      const res = await playerAgent.get('/api/tournaments').query({ q: 'open' });

      assert.deepEqual(res.body.items[0].entries, { approved: 1, pending: 1 });
    });

    it('filters by status, format and name, matching text literally', async () => {
      const names = (res) => res.body.items.map((t) => t.name);

      assert.deepEqual(
        names(await adminAgent.get('/api/tournaments').query({ status: 'completed' })),
        ['Old Cup']
      );
      assert.deepEqual(
        names(await adminAgent.get('/api/tournaments').query({ format: 'knockout' })),
        ['Old Cup']
      );
      assert.equal((await adminAgent.get('/api/tournaments').query({ q: '.*' })).body.total, 0);
    });

    it('paginates', async () => {
      const res = await adminAgent.get('/api/tournaments').query({ limit: 2, page: 2 });
      assert.equal(res.body.items.length, 1);
      assert.equal(res.body.pages, 2);
    });
  });

  describe('GET /api/tournaments/:id', () => {
    it('returns a competition with its counts', async () => {
      const t = await make({ status: 'registration' });
      await enter(t);

      const res = await playerAgent.get(`/api/tournaments/${t.id}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.tournament.name, 'Spring League');
      assert.deepEqual(res.body.tournament.entries, { approved: 1, pending: 0 });
    });

    it('hides a draft from players but not from admins', async () => {
      const t = await make();

      assert.equal((await playerAgent.get(`/api/tournaments/${t.id}`)).status, 404);
      assert.equal((await adminAgent.get(`/api/tournaments/${t.id}`)).status, 200);
    });

    it('rejects a malformed id and reports an unknown one', async () => {
      assert.equal((await playerAgent.get('/api/tournaments/nope')).status, 400);
      assert.equal((await playerAgent.get(`/api/tournaments/${'f'.repeat(24)}`)).status, 404);
    });
  });

  describe('PATCH /api/tournaments/:id', () => {
    const patch = (t, body) => adminAgent.patch(`/api/tournaments/${t.id}`).send(body);

    it('edits only what is sent', async () => {
      const t = await make();
      const res = await patch(t, { name: 'Spring League 2', maxTeams: 16 });

      assert.equal(res.status, 200);
      assert.equal(res.body.tournament.name, 'Spring League 2');
      assert.equal(res.body.tournament.maxTeams, 16);
      assert.equal(res.body.tournament.format, 'league');
      assert.equal((await Tournament.findById(t._id)).nameKey, 'spring league 2');
    });

    it('can change the format while it is a draft', async () => {
      const t = await make();
      assert.equal((await patch(t, { format: 'knockout' })).status, 200);
    });

    it('locks the format once registration is open', async () => {
      const t = await make({ status: 'registration' });

      assert.equal((await patch(t, { format: 'knockout' })).status, 409);
      assert.equal((await patch(t, { name: 'Renamed' })).status, 200);
    });

    it('cannot edit a competition that has started or ended', async () => {
      for (const status of ['active', 'completed', 'cancelled']) {
        const t = await make({ name: `Tournament ${status}`, status });
        assert.equal((await patch(t, { name: 'Nope' })).status, 409, status);
      }
    });

    it('keeps room for the teams that already entered', async () => {
      const t = await make({ status: 'registration' });
      await enter(t);
      await enter(t, 'pending');
      await enter(t, 'pending');

      assert.equal((await patch(t, { maxTeams: 2 })).status, 409);
      assert.equal((await patch(t, { maxTeams: 3 })).status, 200);
    });

    it('checks the rules against what is already saved', async () => {
      const cupDraft = await make({ name: 'A Cup', format: 'knockout' });
      assert.equal((await patch(cupDraft, { legs: 2 })).status, 400);

      const dated = await make({ name: 'Dated', startsAt: new Date('2026-11-01') });
      assert.equal(
        (await patch(dated, { registrationDeadline: '2026-12-01T00:00:00.000Z' })).status,
        400
      );
    });

    it('rejects an empty update and fields it may not touch', async () => {
      const t = await make();
      assert.equal((await patch(t, {})).status, 400);
      assert.equal((await patch(t, { status: 'active' })).status, 400);
    });
  });

  describe('POST /api/tournaments/:id/status', () => {
    const setStatus = (t, status) =>
      adminAgent.post(`/api/tournaments/${t.id}/status`).send({ status });

    it('opens registration, and can go back to draft while nobody has entered', async () => {
      const t = await make();

      assert.equal((await setStatus(t, 'registration')).body.tournament.status, 'registration');
      assert.equal((await setStatus(t, 'draft')).body.tournament.status, 'draft');
    });

    it('will not open registration after its deadline', async () => {
      const t = await make({ registrationDeadline: new Date(Date.now() - 86_400_000) });

      const res = await setStatus(t, 'registration');
      assert.equal(res.status, 400);
      assert.match(res.body.message, /deadline/);
    });

    it('will not go back to draft once teams have entered', async () => {
      const t = await make({ status: 'registration' });
      await enter(t, 'pending');

      const res = await setStatus(t, 'draft');
      assert.equal(res.status, 409);
      assert.equal((await Tournament.findById(t._id)).status, 'registration');
    });

    it('can cancel a draft or an open competition', async () => {
      const draft = await make({ name: 'Draft One' });
      const open = await make({ name: 'Open One', status: 'registration' });

      assert.equal((await setStatus(draft, 'cancelled')).body.tournament.status, 'cancelled');
      assert.equal((await setStatus(open, 'cancelled')).body.tournament.status, 'cancelled');
    });

    it('does not allow the other changes of state', async () => {
      const cancelled = await make({ name: 'Cancelled One', status: 'cancelled' });
      const active = await make({ name: 'Active One', status: 'active' });

      assert.equal((await setStatus(cancelled, 'registration')).status, 409);
      assert.equal((await setStatus(active, 'cancelled')).status, 409);
    });

    it('cannot be asked to start or finish a competition', async () => {
      const t = await make({ status: 'registration' });

      assert.equal((await setStatus(t, 'active')).status, 400);
      assert.equal((await setStatus(t, 'completed')).status, 400);
    });
  });

  describe('DELETE /api/tournaments/:id', () => {
    it('deletes an empty draft', async () => {
      const t = await make();

      assert.equal((await adminAgent.delete(`/api/tournaments/${t.id}`)).status, 200);
      assert.equal(await Tournament.countDocuments(), 0);
    });

    it('refuses anything that is not an empty draft', async () => {
      const open = await make({ name: 'Open', status: 'registration' });
      const withEntry = await make({ name: 'WithEntry' });
      await enter(withEntry);

      assert.equal((await adminAgent.delete(`/api/tournaments/${open.id}`)).status, 409);
      assert.equal((await adminAgent.delete(`/api/tournaments/${withEntry.id}`)).status, 409);
      assert.equal(await Tournament.countDocuments(), 2);
    });
  });
});
