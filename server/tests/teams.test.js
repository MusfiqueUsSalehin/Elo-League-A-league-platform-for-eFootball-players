import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { MAX_TEAMS_PER_OWNER } from '../src/config/limits.js';
import Footballer from '../src/models/Footballer.js';
import Team from '../src/models/Team.js';
import { createTestUser, loginAgent } from './helpers/auth.js';
import { buildTestApp } from './helpers/app.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';
import { createFootballer, createTeam } from './helpers/teams.js';

describe('teams', () => {
  const { app } = buildTestApp();
  let rahim;
  let sadia;
  let adminAgent;
  let rahimAgent;
  let sadiaAgent;

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);
  beforeEach(async () => {
    await createTestUser({ role: 'admin', username: 'boss', name: 'League Admin' });
    rahim = await createTestUser({ username: 'rahim', name: 'Rahim Uddin' });
    sadia = await createTestUser({ username: 'sadia', name: 'Sadia Rahman' });
    adminAgent = await loginAgent(app, 'boss');
    rahimAgent = await loginAgent(app, 'rahim');
    sadiaAgent = await loginAgent(app, 'sadia');
  });

  describe('access', () => {
    it('requires a session', async () => {
      assert.equal((await request(app).get('/api/teams')).status, 401);
    });

    it('blocks an account that still has a temporary password', async () => {
      await createTestUser({ username: 'fresh', mustChangePassword: true });
      const agent = await loginAgent(app, 'fresh');
      const res = await agent.get('/api/teams');

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
    });
  });

  describe('POST /api/teams', () => {
    it('creates a team owned by the signed-in player', async () => {
      const res = await rahimAgent.post('/api/teams').send({ name: 'Red Devils' });

      assert.equal(res.status, 201);
      assert.equal(res.body.team.name, 'Red Devils');
      assert.equal(res.body.team.formation, '4-3-3');
      assert.equal(res.body.team.owner.username, 'rahim');
      assert.equal(res.body.team.squadSize, 0);
      assert.equal(res.body.team.nameKey, undefined);
    });

    it('accepts a formation', async () => {
      const res = await rahimAgent
        .post('/api/teams')
        .send({ name: 'Red Devils', formation: '4-4-2' });
      assert.equal(res.body.team.formation, '4-4-2');
    });

    it('rejects an unknown formation and a bad name', async () => {
      assert.equal(
        (await rahimAgent.post('/api/teams').send({ name: 'Red Devils', formation: '9-9-9' }))
          .status,
        400
      );
      assert.equal((await rahimAgent.post('/api/teams').send({ name: 'R' })).status, 400);
      assert.equal((await rahimAgent.post('/api/teams').send({})).status, 400);
    });

    it('ignores fields a caller must not set', async () => {
      const res = await rahimAgent.post('/api/teams').send({
        name: 'Red Devils',
        owner: sadia.id,
        lineup: [{ slot: 0, footballer: '507f1f77bcf86cd799439011' }],
      });

      assert.equal(res.status, 201);
      const stored = await Team.findById(res.body.team._id);
      assert.equal(String(stored.owner), rahim.id);
      assert.equal(stored.lineup.length, 0);
    });

    it('lets an admin create a team for another player', async () => {
      const res = await adminAgent
        .post('/api/teams')
        .send({ name: 'Blue Moon', ownerId: sadia.id });

      assert.equal(res.status, 201);
      assert.equal(res.body.team.owner.username, 'sadia');
    });

    it('stops a player creating a team for someone else', async () => {
      const res = await rahimAgent
        .post('/api/teams')
        .send({ name: 'Blue Moon', ownerId: sadia.id });
      assert.equal(res.status, 403);
    });

    it('lets a player name themselves as the owner', async () => {
      const res = await rahimAgent.post('/api/teams').send({ name: 'Mine', ownerId: rahim.id });
      assert.equal(res.status, 201);
    });

    it('refuses an owner who does not exist or is deactivated', async () => {
      const missing = await adminAgent
        .post('/api/teams')
        .send({ name: 'Ghost FC', ownerId: '507f1f77bcf86cd799439011' });
      assert.equal(missing.status, 404);

      const inactive = await createTestUser({ username: 'gone', isActive: false });
      const res = await adminAgent
        .post('/api/teams')
        .send({ name: 'Gone FC', ownerId: inactive.id });
      assert.equal(res.status, 404);
    });

    it('treats names as the same regardless of letter case, per owner', async () => {
      await rahimAgent.post('/api/teams').send({ name: 'Red Devils' });

      const duplicate = await rahimAgent.post('/api/teams').send({ name: 'red devils' });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.message, 'You already have a team with that name');

      const otherOwner = await sadiaAgent.post('/api/teams').send({ name: 'Red Devils' });
      assert.equal(otherOwner.status, 201);
    });

    it('limits how many teams one player can have', async () => {
      for (let i = 0; i < MAX_TEAMS_PER_OWNER; i++) await createTeam(rahim);

      const res = await rahimAgent.post('/api/teams').send({ name: 'One Too Many' });
      assert.equal(res.status, 409);
      assert.match(res.body.message, /at most 5 teams/);
    });
  });

  describe('GET /api/teams', () => {
    beforeEach(async () => {
      const arsenal = await createTeam(rahim, { name: 'Arsenal' });
      await createTeam(rahim, { name: 'Brighton' });
      await createTeam(sadia, { name: 'Chelsea' });
      await createFootballer(arsenal, { rating: 90 });
      await createFootballer(arsenal, { rating: 80 });
    });

    it('lets any signed-in player see every team, sorted by name', async () => {
      const res = await sadiaAgent.get('/api/teams');

      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.items.map((team) => team.name),
        ['Arsenal', 'Brighton', 'Chelsea']
      );
      assert.equal(res.body.total, 3);
    });

    it('shows owner details and squad figures', async () => {
      const res = await sadiaAgent.get('/api/teams');
      const arsenal = res.body.items.find((team) => team.name === 'Arsenal');
      const brighton = res.body.items.find((team) => team.name === 'Brighton');

      assert.equal(arsenal.owner.name, 'Rahim Uddin');
      assert.equal(arsenal.owner.passwordHash, undefined);
      assert.equal(arsenal.squadSize, 2);
      assert.equal(arsenal.squadRating, 85);
      assert.equal(brighton.squadSize, 0);
      assert.equal(brighton.squadRating, 0);
    });

    it('can show just my teams', async () => {
      const res = await rahimAgent.get('/api/teams').query({ mine: 'true' });
      assert.deepEqual(
        res.body.items.map((team) => team.name),
        ['Arsenal', 'Brighton']
      );
    });

    it('can show one owner’s teams', async () => {
      const res = await adminAgent.get('/api/teams').query({ owner: sadia.id });
      assert.deepEqual(
        res.body.items.map((team) => team.name),
        ['Chelsea']
      );
    });

    it('searches by name, matching text literally', async () => {
      const found = await adminAgent.get('/api/teams').query({ q: 'ARSE' });
      assert.deepEqual(
        found.body.items.map((team) => team.name),
        ['Arsenal']
      );

      const wildcard = await adminAgent.get('/api/teams').query({ q: '.*' });
      assert.equal(wildcard.body.total, 0);
    });

    it('paginates', async () => {
      const res = await adminAgent.get('/api/teams').query({ limit: 2, page: 2 });

      assert.deepEqual(
        res.body.items.map((team) => team.name),
        ['Chelsea']
      );
      assert.equal(res.body.pages, 2);
      assert.equal(res.body.total, 3);
    });

    it('rejects a malformed owner id', async () => {
      assert.equal((await adminAgent.get('/api/teams').query({ owner: 'nope' })).status, 400);
    });
  });

  describe('GET /api/teams/:id', () => {
    it('returns the team with its squad, best rated first', async () => {
      const team = await createTeam(rahim, { name: 'Arsenal' });
      await createFootballer(team, { name: 'Bukayo Saka', rating: 88 });
      await createFootballer(team, { name: 'Martin Odegaard', rating: 90 });

      const res = await sadiaAgent.get(`/api/teams/${team.id}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.team.name, 'Arsenal');
      assert.equal(res.body.team.squadSize, 2);
      assert.deepEqual(
        res.body.squad.map((p) => p.name),
        ['Martin Odegaard', 'Bukayo Saka']
      );
      assert.equal(res.body.squad[0].nameKey, undefined);
    });

    it('rejects a malformed id and reports an unknown one', async () => {
      assert.equal((await rahimAgent.get('/api/teams/not-an-id')).status, 400);
      assert.equal((await rahimAgent.get(`/api/teams/${'f'.repeat(24)}`)).status, 404);
    });
  });

  describe('PATCH /api/teams/:id', () => {
    let team;
    beforeEach(async () => {
      team = await createTeam(rahim, { name: 'Arsenal' });
    });

    it('lets the owner rename the team and change its formation', async () => {
      const res = await rahimAgent
        .patch(`/api/teams/${team.id}`)
        .send({ name: 'Gunners', formation: '3-5-2' });

      assert.equal(res.status, 200);
      assert.equal(res.body.team.name, 'Gunners');
      assert.equal(res.body.team.formation, '3-5-2');
      assert.equal((await Team.findById(team._id)).nameKey, 'gunners');
    });

    it('stops other players, and lets an admin through', async () => {
      assert.equal(
        (await sadiaAgent.patch(`/api/teams/${team.id}`).send({ name: 'Mine now' })).status,
        403
      );
      assert.equal(
        (await adminAgent.patch(`/api/teams/${team.id}`).send({ name: 'Admin edit' })).status,
        200
      );
    });

    it('cannot move the team to another owner or rewrite the line-up', async () => {
      const res = await rahimAgent
        .patch(`/api/teams/${team.id}`)
        .send({ name: 'Gunners', owner: sadia.id, lineup: [] });

      assert.equal(res.status, 200);
      assert.equal(String((await Team.findById(team._id)).owner), rahim.id);
    });

    it('rejects an update that changes nothing allowed', async () => {
      assert.equal((await rahimAgent.patch(`/api/teams/${team.id}`).send({})).status, 400);
      assert.equal(
        (await rahimAgent.patch(`/api/teams/${team.id}`).send({ owner: sadia.id })).status,
        400
      );
    });

    it('refuses a name the owner already uses on another team', async () => {
      await createTeam(rahim, { name: 'Brighton' });
      const res = await rahimAgent.patch(`/api/teams/${team.id}`).send({ name: 'BRIGHTON' });
      assert.equal(res.status, 409);
    });

    it('lets a team keep its own name when only the case changes', async () => {
      const res = await rahimAgent.patch(`/api/teams/${team.id}`).send({ name: 'ARSENAL' });
      assert.equal(res.status, 200);
    });
  });

  describe('DELETE /api/teams/:id', () => {
    it('removes the team and its squad', async () => {
      const team = await createTeam(rahim);
      await createFootballer(team);

      const res = await rahimAgent.delete(`/api/teams/${team.id}`);

      assert.equal(res.status, 200);
      assert.equal(await Team.countDocuments(), 0);
      assert.equal(await Footballer.countDocuments(), 0);
    });

    it('leaves other teams alone', async () => {
      const mine = await createTeam(rahim);
      const theirs = await createTeam(sadia);
      await createFootballer(theirs);

      await rahimAgent.delete(`/api/teams/${mine.id}`);

      assert.equal(await Team.countDocuments(), 1);
      assert.equal(await Footballer.countDocuments(), 1);
    });

    it('stops other players, and lets an admin through', async () => {
      const team = await createTeam(rahim);

      assert.equal((await sadiaAgent.delete(`/api/teams/${team.id}`)).status, 403);
      assert.equal(await Team.countDocuments(), 1);
      assert.equal((await adminAgent.delete(`/api/teams/${team.id}`)).status, 200);
    });
  });

  describe('PUT /api/teams/:id/lineup', () => {
    let team;
    let players;
    beforeEach(async () => {
      team = await createTeam(rahim);
      players = [];
      for (let i = 0; i < 12; i++) {
        players.push(await createFootballer(team, { name: `Starter ${i}` }));
      }
    });

    const starters = (list) => list.map((player, slot) => ({ slot, footballer: player.id }));
    const put = (agent, body, id = team.id) => agent.put(`/api/teams/${id}/lineup`).send(body);

    it('saves a full starting XI in slot order', async () => {
      const res = await put(rahimAgent, {
        formation: '4-4-2',
        starters: starters(players.slice(0, 11)).reverse(),
      });

      assert.equal(res.status, 200);
      const stored = await Team.findById(team._id);
      assert.equal(stored.formation, '4-4-2');
      assert.deepEqual(
        stored.lineup.map((s) => s.slot),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
      assert.equal(String(stored.lineup[0].footballer), players[0].id);
    });

    it('accepts a partial line-up while the manager is still picking', async () => {
      const res = await put(rahimAgent, {
        formation: '4-3-3',
        starters: starters(players.slice(0, 3)),
      });

      assert.equal(res.status, 200);
      assert.equal((await Team.findById(team._id)).lineup.length, 3);
    });

    it('replaces the previous line-up completely', async () => {
      await put(rahimAgent, { formation: '4-3-3', starters: starters(players.slice(0, 11)) });
      await put(rahimAgent, { formation: '4-3-3', starters: starters(players.slice(0, 2)) });

      assert.equal((await Team.findById(team._id)).lineup.length, 2);
    });

    it('can clear the line-up', async () => {
      await put(rahimAgent, { formation: '4-3-3', starters: starters(players.slice(0, 5)) });
      const res = await put(rahimAgent, { formation: '4-3-3', starters: [] });

      assert.equal(res.status, 200);
      assert.equal((await Team.findById(team._id)).lineup.length, 0);
    });

    it('rejects more than 11 starters, a bad slot and an unknown formation', async () => {
      assert.equal(
        (await put(rahimAgent, { formation: '4-3-3', starters: starters(players) })).status,
        400
      );
      assert.equal(
        (
          await put(rahimAgent, {
            formation: '4-3-3',
            starters: [{ slot: 11, footballer: players[0].id }],
          })
        ).status,
        400
      );
      assert.equal(
        (
          await put(rahimAgent, {
            formation: '4-3-3',
            starters: [{ slot: -1, footballer: players[0].id }],
          })
        ).status,
        400
      );
      assert.equal((await put(rahimAgent, { formation: '1-1-1', starters: [] })).status, 400);
    });

    it('rejects two players in one position', async () => {
      const res = await put(rahimAgent, {
        formation: '4-3-3',
        starters: [
          { slot: 0, footballer: players[0].id },
          { slot: 0, footballer: players[1].id },
        ],
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /only one player/);
    });

    it('rejects one player in two positions', async () => {
      const res = await put(rahimAgent, {
        formation: '4-3-3',
        starters: [
          { slot: 0, footballer: players[0].id },
          { slot: 1, footballer: players[0].id },
        ],
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /only start once/);
    });

    it('rejects a player who is not in this squad', async () => {
      const other = await createFootballer(await createTeam(sadia));
      const res = await put(rahimAgent, {
        formation: '4-3-3',
        starters: [{ slot: 0, footballer: other.id }],
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /must be in this team/);
      assert.equal((await Team.findById(team._id)).lineup.length, 0);
    });

    it('stops other players, and lets an admin through', async () => {
      const body = { formation: '4-3-3', starters: starters(players.slice(0, 2)) };

      assert.equal((await put(sadiaAgent, body)).status, 403);
      assert.equal((await put(adminAgent, body)).status, 200);
    });

    it('returns the line-up with the team', async () => {
      await put(rahimAgent, { formation: '4-3-3', starters: starters(players.slice(0, 2)) });
      const res = await rahimAgent.get(`/api/teams/${team.id}`);

      assert.equal(res.body.team.lineup.length, 2);
      assert.equal(res.body.team.lineup[0].footballer, players[0].id);
    });
  });
});
