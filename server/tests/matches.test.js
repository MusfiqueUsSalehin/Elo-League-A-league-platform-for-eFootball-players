import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/config/logger.js';
import Match from '../src/models/Match.js';
import Tournament from '../src/models/Tournament.js';
import TournamentEntry from '../src/models/TournamentEntry.js';
import { buildTestEnv } from './helpers/app.js';
import { createTestUser, loginAgent } from './helpers/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';
import { createTeam } from './helpers/teams.js';

describe('fixtures and matches', () => {
  const env = buildTestEnv();
  const sent = [];
  const notify = async (ids, message) => {
    sent.push({ ids: ids.map(String), ...message });
    return {};
  };
  const app = createApp({ env, logger: createLogger(env), isReady: async () => true, notify });

  let admin;
  let adminAgent;
  let tournament;

  const addTeams = async (count, status = 'approved') => {
    const created = [];
    for (let i = 0; i < count; i++) {
      const owner = await createTestUser();
      const team = await createTeam(owner, { name: `Club ${created.length + i + 1}` });
      await TournamentEntry.create({
        tournament: tournament._id,
        team: team._id,
        owner: owner._id,
        status,
        seed: status === 'approved' ? i + 1 : null,
      });
      created.push({ owner, team });
    }
    return created;
  };
  const draw = (body = {}) =>
    adminAgent.post(`/api/tournaments/${tournament.id}/fixtures`).send(body);
  const countMatches = () => Match.countDocuments({ tournament: tournament._id });

  before(startTestDb);
  after(stopTestDb);
  beforeEach(async () => {
    sent.length = 0;
    admin = await createTestUser({ role: 'admin' });
    adminAgent = await loginAgent(app, admin.username);
    tournament = await Tournament.create({
      name: 'Spring League',
      format: 'league',
      maxTeams: 8,
      status: 'registration',
      createdBy: admin._id,
    });
  });
  afterEach(clearTestDb);

  describe('drawing', () => {
    it('draws a league, starts the competition and tells the managers', async () => {
      const teams = await addTeams(4);
      const res = await draw();

      assert.equal(res.status, 201);
      assert.equal(res.body.matches, 6);
      assert.equal(await countMatches(), 6);
      assert.equal((await Tournament.findById(tournament._id)).status, 'active');

      const note = sent.find((message) => message.type === 'match');
      assert.deepEqual([...note.ids].sort(), teams.map(({ owner }) => String(owner._id)).sort());
    });

    it('plays home and away when the league has two legs', async () => {
      await Tournament.updateOne({ _id: tournament._id }, { legs: 2 });
      await addTeams(4);
      assert.equal((await draw()).body.matches, 12);
    });

    it('draws a cup with byes', async () => {
      await Tournament.updateOne({ _id: tournament._id }, { format: 'knockout' });
      await addTeams(6);
      const res = await draw({ intervalDays: 3 });

      assert.equal(res.body.matches, 5);
      const final = await Match.findOne({ tournament: tournament._id, round: 3 });
      assert.equal(final.roundName, 'Final');
      assert.equal(final.homeTeam, null);
    });

    it('refuses while entries are waiting, with too few teams, or twice', async () => {
      await addTeams(1);
      assert.equal((await draw()).status, 409, 'one team is not enough');

      await addTeams(1, 'pending');
      assert.equal((await draw()).status, 409, 'a pending entry blocks the draw');

      await TournamentEntry.updateMany({ tournament: tournament._id }, { status: 'approved' });
      assert.equal((await draw()).status, 201);
      assert.equal((await draw()).status, 409, 'already drawn');
      assert.equal(await countMatches(), 1);
    });

    it('is for admins only', async () => {
      const [{ owner }] = await addTeams(2);
      const agent = await loginAgent(app, owner.username);
      const res = await agent.post(`/api/tournaments/${tournament.id}/fixtures`).send({});
      assert.equal(res.status, 403);
    });
  });

  describe('withdrawing', () => {
    it('removes fixtures that have not started and reopens registration', async () => {
      await addTeams(4);
      await draw();
      const res = await adminAgent.delete(`/api/tournaments/${tournament.id}/fixtures`);

      assert.equal(res.status, 200);
      assert.equal(await countMatches(), 0);
      assert.equal((await Tournament.findById(tournament._id)).status, 'registration');
    });

    it('locks once a match has started', async () => {
      await addTeams(4);
      await draw();
      await Match.updateOne({ tournament: tournament._id }, { status: 'live' });

      const res = await adminAgent.delete(`/api/tournaments/${tournament.id}/fixtures`);
      assert.equal(res.status, 409);
      assert.equal(await countMatches(), 6);
    });
  });

  describe('reading and moving matches', () => {
    it('lists a competition in order, and only my matches with mine=true', async () => {
      const teams = await addTeams(4);
      await draw();

      const all = await adminAgent.get(`/api/matches?tournament=${tournament.id}`);
      assert.equal(all.body.items.length, 6);
      const rounds = all.body.items.map((match) => match.round);
      assert.deepEqual(
        rounds,
        [...rounds].sort((a, b) => a - b)
      );

      const agent = await loginAgent(app, teams[0].owner.username);
      const mine = await agent.get('/api/matches?mine=true');
      assert.equal(mine.body.items.length, 3);
    });

    it('lets an admin move a kick-off and tells both players', async () => {
      await addTeams(2);
      await draw();
      const match = await Match.findOne({ tournament: tournament._id });
      sent.length = 0;

      const later = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const res = await adminAgent.patch(`/api/matches/${match.id}`).send({ scheduledAt: later });

      assert.equal(res.status, 200);
      assert.equal(new Date(res.body.match.scheduledAt).toISOString(), later);
      assert.equal(sent[0].ids.length, 2);
    });

    it('rejects a time in the past and a player trying to move a match', async () => {
      const [{ owner }] = await addTeams(2);
      await draw();
      const match = await Match.findOne({ tournament: tournament._id });

      const past = await adminAgent
        .patch(`/api/matches/${match.id}`)
        .send({ scheduledAt: '2020-01-01T00:00:00Z' });
      assert.equal(past.status, 400);

      const agent = await loginAgent(app, owner.username);
      const denied = await agent
        .patch(`/api/matches/${match.id}`)
        .send({ scheduledAt: new Date(Date.now() + 86400000).toISOString() });
      assert.equal(denied.status, 403);
    });
  });

  it('keeps an entered team from being deleted', async () => {
    const [{ owner, team }] = await addTeams(2);
    const agent = await loginAgent(app, owner.username);
    assert.equal((await agent.delete(`/api/teams/${team.id}`)).status, 409);
  });
});
