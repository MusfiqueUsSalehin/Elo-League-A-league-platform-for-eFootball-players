import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/config/logger.js';
import Tournament from '../src/models/Tournament.js';
import TournamentEntry from '../src/models/TournamentEntry.js';
import { buildTestApp, buildTestEnv } from './helpers/app.js';
import { createTestUser, loginAgent } from './helpers/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';
import { createTeam, fillSquad } from './helpers/teams.js';

describe('tournament entries', () => {
  const env = buildTestEnv();
  const notifications = [];
  const notify = async (ids, message) => {
    notifications.push({ ids: ids.map(String), ...message });
    return {};
  };
  const app = createApp({ env, logger: createLogger(env), isReady: async () => true, notify });

  let admin;
  let rahim;
  let sadia;
  let adminAgent;
  let rahimAgent;
  let sadiaAgent;
  let tournament;

  const squadTeam = async (owner, name, players = 11) => {
    const team = await createTeam(owner, { name });
    await fillSquad(team, players);
    return team;
  };
  const url = (suffix = '') => `/api/tournaments/${tournament.id}${suffix}`;
  const enter = (agent, team) => agent.post(url('/entries')).send({ teamId: team.id });
  const entryOf = (team, status = 'approved', owner = rahim) =>
    TournamentEntry.create({
      tournament: tournament._id,
      team: team._id,
      owner: owner._id,
      status,
    });

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);
  beforeEach(async () => {
    notifications.length = 0;
    admin = await createTestUser({ role: 'admin', username: 'boss' });
    rahim = await createTestUser({ username: 'rahim' });
    sadia = await createTestUser({ username: 'sadia' });
    adminAgent = await loginAgent(app, 'boss');
    rahimAgent = await loginAgent(app, 'rahim');
    sadiaAgent = await loginAgent(app, 'sadia');
    tournament = await Tournament.create({
      createdBy: admin._id,
      name: 'Spring League',
      format: 'league',
      maxTeams: 4,
      status: 'registration',
    });
  });

  describe('entering', () => {
    it('puts a team in as pending when the admin has to approve', async () => {
      const team = await squadTeam(rahim, 'Arsenal');
      const res = await enter(rahimAgent, team);

      assert.equal(res.status, 201);
      assert.equal(res.body.entry.status, 'pending');
      assert.equal(res.body.entry.team.name, 'Arsenal');
      assert.equal(res.body.entry.owner.username, 'rahim');
    });

    it('approves straight away when no approval is needed', async () => {
      await Tournament.updateOne({ _id: tournament._id }, { requiresApproval: false });
      const res = await enter(rahimAgent, await squadTeam(rahim, 'Arsenal'));

      assert.equal(res.body.entry.status, 'approved');
      assert.equal(notifications.length, 0);
    });

    it('tells the admins when an entry is waiting', async () => {
      await enter(rahimAgent, await squadTeam(rahim, 'Arsenal'));

      assert.equal(notifications.length, 1);
      assert.deepEqual(notifications[0].ids, [admin.id]);
      assert.equal(notifications[0].type, 'tournament');
      assert.match(notifications[0].title, /Arsenal wants to join Spring League/);
      assert.equal(notifications[0].link, `/tournaments/${tournament.id}`);
    });

    it('stops a manager entering someone else’s team, but lets an admin', async () => {
      const team = await squadTeam(sadia, 'Chelsea');

      assert.equal((await enter(rahimAgent, team)).status, 403);
      assert.equal((await enter(adminAgent, team)).status, 201);
    });

    it('needs registration to be open', async () => {
      const team = await squadTeam(rahim, 'Arsenal');
      for (const status of ['draft', 'active', 'completed', 'cancelled']) {
        await Tournament.updateOne({ _id: tournament._id }, { status });
        const res = await enter(rahimAgent, team);
        assert.equal(res.status, status === 'draft' ? 404 : 409, status);
      }
    });

    it('refuses an entry after the deadline', async () => {
      await Tournament.updateOne(
        { _id: tournament._id },
        { registrationDeadline: new Date(Date.now() - 1000) }
      );
      const res = await enter(rahimAgent, await squadTeam(rahim, 'Arsenal'));

      assert.equal(res.status, 409);
      assert.match(res.body.message, /deadline/);
    });

    it('needs a squad big enough to field a team', async () => {
      const res = await enter(rahimAgent, await squadTeam(rahim, 'Arsenal', 10));

      assert.equal(res.status, 409);
      assert.match(res.body.message, /at least 11 players/);
    });

    it('refuses the same team twice, and a second team from the same manager', async () => {
      const first = await squadTeam(rahim, 'Arsenal');
      const second = await squadTeam(rahim, 'Brighton');
      await enter(rahimAgent, first);

      assert.equal((await enter(rahimAgent, first)).body.message, 'That team has already entered');
      assert.match((await enter(rahimAgent, second)).body.message, /already has a team/);
    });

    it('stops when the competition is full, counting pending entries', async () => {
      for (let i = 0; i < 4; i++) {
        const owner = await createTestUser({ username: `m${i}` });
        await entryOf(await squadTeam(owner, `Team ${i}`), i % 2 ? 'pending' : 'approved', owner);
      }

      const res = await enter(rahimAgent, await squadTeam(rahim, 'Arsenal'));
      assert.equal(res.status, 409);
      assert.match(res.body.message, /full/);
    });

    it('lets a team that withdrew come back, but not one that was turned down', async () => {
      const team = await squadTeam(rahim, 'Arsenal');
      const { body } = await enter(rahimAgent, team);
      await rahimAgent.delete(url(`/entries/${body.entry._id}`));

      const again = await enter(rahimAgent, team);
      assert.equal(again.status, 201);
      assert.equal(again.body.entry.status, 'pending');
      assert.equal(await TournamentEntry.countDocuments(), 1);

      await adminAgent.patch(url(`/entries/${body.entry._id}`)).send({ status: 'rejected' });
      assert.equal((await enter(rahimAgent, team)).status, 409);
    });

    it('rejects a bad team id and an unknown team', async () => {
      assert.equal((await rahimAgent.post(url('/entries')).send({ teamId: 'nope' })).status, 400);
      assert.equal(
        (await rahimAgent.post(url('/entries')).send({ teamId: 'f'.repeat(24) })).status,
        404
      );
    });
  });

  describe('who can see the entries', () => {
    it('shows everyone the approved teams, and managers their own', async () => {
      await entryOf(await squadTeam(rahim, 'Arsenal'), 'approved', rahim);
      await entryOf(await squadTeam(sadia, 'Chelsea'), 'pending', sadia);
      const third = await createTestUser({ username: 'third' });
      await entryOf(await squadTeam(third, 'Everton'), 'rejected', third);

      const names = (res) => res.body.items.map((e) => e.team.name).sort();
      assert.deepEqual(names(await rahimAgent.get(url('/entries'))), ['Arsenal']);
      assert.deepEqual(names(await sadiaAgent.get(url('/entries'))), ['Arsenal', 'Chelsea']);
      assert.deepEqual(names(await adminAgent.get(url('/entries'))), [
        'Arsenal',
        'Chelsea',
        'Everton',
      ]);
    });

    it('hides the entries of a draft from players', async () => {
      await Tournament.updateOne({ _id: tournament._id }, { status: 'draft' });

      assert.equal((await rahimAgent.get(url('/entries'))).status, 404);
      assert.equal((await adminAgent.get(url('/entries'))).status, 200);
    });
  });

  describe('deciding', () => {
    let entry;
    beforeEach(async () => {
      entry = await entryOf(await squadTeam(rahim, 'Arsenal'), 'pending');
    });
    const decide = (agent, status) => agent.patch(url(`/entries/${entry.id}`)).send({ status });

    it('lets an admin approve, and tells the manager', async () => {
      const res = await decide(adminAgent, 'approved');

      assert.equal(res.body.entry.status, 'approved');
      assert.equal(String((await TournamentEntry.findById(entry._id)).decidedBy), admin.id);
      assert.deepEqual(notifications.at(-1).ids, [rahim.id]);
      assert.match(notifications.at(-1).title, /Arsenal is in Spring League/);
    });

    it('lets an admin turn a team down, and tells the manager', async () => {
      await decide(adminAgent, 'rejected');

      assert.match(notifications.at(-1).title, /was not accepted/);
    });

    it('is for admins only', async () => {
      assert.equal((await decide(rahimAgent, 'approved')).status, 403);
      assert.equal((await TournamentEntry.findById(entry._id)).status, 'pending');
    });

    it('only decides an entry once', async () => {
      await decide(adminAgent, 'approved');
      assert.equal((await decide(adminAgent, 'rejected')).status, 409);
    });

    it('needs registration to be open', async () => {
      await Tournament.updateOne({ _id: tournament._id }, { status: 'active' });
      assert.equal((await decide(adminAgent, 'approved')).status, 409);
    });

    it('rejects a decision other than approved or rejected', async () => {
      assert.equal((await decide(adminAgent, 'pending')).status, 400);
    });
  });

  describe('withdrawing', () => {
    let entry;
    beforeEach(async () => {
      entry = await entryOf(await squadTeam(rahim, 'Arsenal'), 'approved');
    });
    const withdraw = (agent) => agent.delete(url(`/entries/${entry.id}`));

    it('lets a manager take their own team out', async () => {
      const res = await withdraw(rahimAgent);

      assert.equal(res.body.entry.status, 'withdrawn');
      assert.equal(notifications.length, 0);
    });

    it('lets an admin remove a team, and tells the manager', async () => {
      await withdraw(adminAgent);

      assert.equal((await TournamentEntry.findById(entry._id)).status, 'withdrawn');
      assert.match(notifications.at(-1).title, /was removed/);
    });

    it('stops other managers', async () => {
      assert.equal((await withdraw(sadiaAgent)).status, 403);
    });

    it('is not possible once the competition has started', async () => {
      await Tournament.updateOne({ _id: tournament._id }, { status: 'active' });
      assert.equal((await withdraw(rahimAgent)).status, 409);
    });

    it('frees the place for another team', async () => {
      await Tournament.updateOne({ _id: tournament._id }, { maxTeams: 2 });
      const other = await createTestUser({ username: 'other' });
      await entryOf(await squadTeam(other, 'Everton'), 'approved', other);
      const waiting = await squadTeam(sadia, 'Chelsea');
      assert.equal((await enter(sadiaAgent, waiting)).status, 409);

      await withdraw(rahimAgent);
      assert.equal((await enter(sadiaAgent, waiting)).status, 201);
    });
  });

  describe('seeding', () => {
    let first;
    let second;
    beforeEach(async () => {
      first = await entryOf(await squadTeam(rahim, 'Arsenal'), 'approved');
      second = await entryOf(await squadTeam(sadia, 'Chelsea'), 'approved', sadia);
    });
    const seed = (agent, order) => agent.put(url('/seeds')).send({ order });

    it('numbers the teams in the order given', async () => {
      const res = await seed(adminAgent, [second.id, first.id]);

      assert.deepEqual(
        res.body.items.map((e) => [e.team.name, e.seed]),
        [
          ['Chelsea', 1],
          ['Arsenal', 2],
        ]
      );
    });

    it('starts again each time, so a team left out loses its seed', async () => {
      await seed(adminAgent, [first.id, second.id]);
      await seed(adminAgent, [second.id]);

      assert.equal((await TournamentEntry.findById(first._id)).seed, null);
      assert.equal((await TournamentEntry.findById(second._id)).seed, 1);
    });

    it('only seeds approved teams, each once', async () => {
      const waiting = await createTestUser({ username: 'waiting' });
      const pending = await entryOf(await squadTeam(waiting, 'Pending'), 'pending', waiting);

      assert.equal((await seed(adminAgent, [pending.id])).status, 400);
      assert.equal((await seed(adminAgent, [first.id, first.id])).status, 400);
      assert.equal((await seed(adminAgent, ['f'.repeat(24)])).status, 400);
    });

    it('is for admins, while registration is open', async () => {
      assert.equal((await seed(rahimAgent, [first.id])).status, 403);
      await Tournament.updateOne({ _id: tournament._id }, { status: 'active' });
      assert.equal((await seed(adminAgent, [first.id])).status, 409);
    });
  });

  it('still works when notifications are not set up', async () => {
    const { app: bare } = buildTestApp();
    const agent = await loginAgent(bare, 'rahim');
    const team = await squadTeam(rahim, 'Arsenal');
    const res = await agent.post(url('/entries')).send({ teamId: team.id });

    assert.equal(res.status, 201);
  });
});
