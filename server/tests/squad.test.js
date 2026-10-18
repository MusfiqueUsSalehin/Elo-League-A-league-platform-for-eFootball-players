import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { MAX_IMPORT_LINES, MAX_SQUAD_SIZE } from '../src/config/limits.js';
import Footballer from '../src/models/Footballer.js';
import Team from '../src/models/Team.js';
import { createTestUser, loginAgent } from './helpers/auth.js';
import { buildTestApp } from './helpers/app.js';
import { clearTestDb, startTestDb, stopTestDb } from './helpers/db.js';
import { createFootballer, createTeam, fillSquad } from './helpers/teams.js';

describe('squads', () => {
  const { app } = buildTestApp();
  let rahim;
  let team;
  let adminAgent;
  let rahimAgent;
  let sadiaAgent;

  before(startTestDb);
  after(stopTestDb);
  afterEach(clearTestDb);
  beforeEach(async () => {
    await createTestUser({ role: 'admin', username: 'boss' });
    rahim = await createTestUser({ username: 'rahim' });
    await createTestUser({ username: 'sadia' });
    adminAgent = await loginAgent(app, 'boss');
    rahimAgent = await loginAgent(app, 'rahim');
    sadiaAgent = await loginAgent(app, 'sadia');
    team = await createTeam(rahim, { name: 'Arsenal' });
  });

  const squadUrl = (suffix = '') => `/api/teams/${team.id}/squad${suffix}`;
  const messi = { name: 'Lionel Messi', position: 'RWF', rating: 99 };

  describe('POST /squad', () => {
    it('adds a player to the squad', async () => {
      const res = await rahimAgent.post(squadUrl()).send(messi);

      assert.equal(res.status, 201);
      assert.equal(res.body.footballer.name, 'Lionel Messi');
      assert.equal(res.body.footballer.team, team.id);
      assert.equal(res.body.footballer.nameKey, undefined);
      assert.equal(await Footballer.countDocuments({ team: team._id }), 1);
    });

    it('rejects a bad position, rating or name', async () => {
      const bad = (changes) => rahimAgent.post(squadUrl()).send({ ...messi, ...changes });

      assert.equal((await bad({ position: 'XYZ' })).status, 400);
      assert.equal((await bad({ rating: 0 })).status, 400);
      assert.equal((await bad({ rating: 121 })).status, 400);
      assert.equal((await bad({ rating: 88.5 })).status, 400);
      assert.equal((await bad({ rating: '88' })).status, 400);
      assert.equal((await bad({ name: 'M' })).status, 400);
      assert.equal((await rahimAgent.post(squadUrl()).send({})).status, 400);
    });

    it('ignores fields a caller must not set', async () => {
      const otherTeam = await createTeam(rahim, { name: 'Brighton' });
      const res = await rahimAgent.post(squadUrl()).send({ ...messi, team: otherTeam.id });

      assert.equal(res.body.footballer.team, team.id);
    });

    it('refuses the same name twice, whatever the letter case', async () => {
      await rahimAgent.post(squadUrl()).send(messi);
      const res = await rahimAgent.post(squadUrl()).send({ ...messi, name: 'lionel messi' });

      assert.equal(res.status, 409);
      assert.equal(res.body.message, 'That player is already in the squad');
    });

    it('lets two teams each have a player with the same name', async () => {
      const other = await createTeam(rahim, { name: 'Brighton' });
      await rahimAgent.post(squadUrl()).send(messi);
      const res = await rahimAgent.post(`/api/teams/${other.id}/squad`).send(messi);

      assert.equal(res.status, 201);
    });

    it('refuses a player once the squad is full', async () => {
      await fillSquad(team, MAX_SQUAD_SIZE);
      const res = await rahimAgent.post(squadUrl()).send(messi);

      assert.equal(res.status, 409);
      assert.match(res.body.message, /at most 40 players/);
    });

    it('stops other players, and lets an admin through', async () => {
      assert.equal((await sadiaAgent.post(squadUrl()).send(messi)).status, 403);
      assert.equal(await Footballer.countDocuments(), 0);
      assert.equal((await adminAgent.post(squadUrl()).send(messi)).status, 201);
    });

    it('reports an unknown team', async () => {
      const res = await rahimAgent.post(`/api/teams/${'f'.repeat(24)}/squad`).send(messi);
      assert.equal(res.status, 404);
    });
  });

  describe('PATCH /squad/:playerId', () => {
    let player;
    beforeEach(async () => {
      player = await createFootballer(team, { name: 'Bukayo Saka', position: 'RWF', rating: 88 });
    });

    it('edits only what is sent', async () => {
      const res = await rahimAgent.patch(squadUrl(`/${player.id}`)).send({ rating: 90 });

      assert.equal(res.status, 200);
      assert.equal(res.body.footballer.rating, 90);
      assert.equal(res.body.footballer.name, 'Bukayo Saka');
      assert.equal(res.body.footballer.position, 'RWF');
    });

    it('can rename and move a player', async () => {
      const res = await rahimAgent
        .patch(squadUrl(`/${player.id}`))
        .send({ name: 'B. Saka', position: 'LWF' });

      assert.equal(res.body.footballer.name, 'B. Saka');
      assert.equal(res.body.footballer.position, 'LWF');
      assert.equal((await Footballer.findById(player._id)).nameKey, 'b. saka');
    });

    it('rejects invalid values and an empty update', async () => {
      const patch = (body) => rahimAgent.patch(squadUrl(`/${player.id}`)).send(body);

      assert.equal((await patch({ rating: 500 })).status, 400);
      assert.equal((await patch({})).status, 400);
      assert.equal((await patch({ team: 'x' })).status, 400);
    });

    it('stops other players', async () => {
      assert.equal(
        (await sadiaAgent.patch(squadUrl(`/${player.id}`)).send({ rating: 1 })).status,
        403
      );
      assert.equal((await Footballer.findById(player._id)).rating, 88);
    });

    it('cannot reach a player of another team through this team', async () => {
      const other = await createTeam(rahim, { name: 'Brighton' });
      const stranger = await createFootballer(other);
      const res = await rahimAgent.patch(squadUrl(`/${stranger.id}`)).send({ rating: 1 });

      assert.equal(res.status, 404);
      assert.notEqual((await Footballer.findById(stranger._id)).rating, 1);
    });

    it('reports a player that does not exist', async () => {
      const res = await rahimAgent.patch(squadUrl(`/${'f'.repeat(24)}`)).send({ rating: 90 });
      assert.equal(res.status, 404);
    });
  });

  describe('DELETE /squad/:playerId', () => {
    it('removes the player', async () => {
      const player = await createFootballer(team);
      const res = await rahimAgent.delete(squadUrl(`/${player.id}`));

      assert.equal(res.status, 200);
      assert.equal(await Footballer.countDocuments(), 0);
    });

    it('takes a starter out of the line-up too', async () => {
      const keeper = await createFootballer(team, { position: 'GK' });
      const striker = await createFootballer(team, { position: 'CF' });
      await rahimAgent.put(`/api/teams/${team.id}/lineup`).send({
        formation: '4-3-3',
        starters: [
          { slot: 0, footballer: keeper.id },
          { slot: 10, footballer: striker.id },
        ],
      });

      await rahimAgent.delete(squadUrl(`/${striker.id}`));

      const stored = await Team.findById(team._id);
      assert.deepEqual(
        stored.lineup.map((s) => String(s.footballer)),
        [keeper.id]
      );
    });

    it('stops other players, and lets an admin through', async () => {
      const player = await createFootballer(team);

      assert.equal((await sadiaAgent.delete(squadUrl(`/${player.id}`))).status, 403);
      assert.equal(await Footballer.countDocuments(), 1);
      assert.equal((await adminAgent.delete(squadUrl(`/${player.id}`))).status, 200);
    });

    it('cannot delete a player of another team through this team', async () => {
      const other = await createTeam(rahim, { name: 'Brighton' });
      const stranger = await createFootballer(other);

      assert.equal((await rahimAgent.delete(squadUrl(`/${stranger.id}`))).status, 404);
      assert.equal(await Footballer.countDocuments(), 1);
    });
  });

  describe('POST /squad/import', () => {
    const paste = (text, agent = rahimAgent) => agent.post(squadUrl('/import')).send({ text });

    it('adds every valid line and reports the rest with their line numbers', async () => {
      const res = await paste(
        [
          'Name, Position, Rating',
          'Lionel Messi, RWF, 99',
          'oops',
          'Kylian Mbappe, CF, 98',
          'Bad Rating, GK, 500',
        ].join('\n')
      );

      assert.equal(res.status, 201);
      assert.deepEqual(
        res.body.added.map((p) => p.name),
        ['Lionel Messi', 'Kylian Mbappe']
      );
      assert.deepEqual(
        res.body.skipped.map((s) => s.line),
        [3, 5]
      );
      assert.equal(await Footballer.countDocuments({ team: team._id }), 2);
    });

    it('skips players who are already in the squad or repeated in the paste', async () => {
      await createFootballer(team, { name: 'Lionel Messi' });
      const res = await paste('lionel messi, RWF, 99\nA Newcomer, CB, 80\nA NEWCOMER, CB, 81');

      assert.deepEqual(
        res.body.added.map((p) => p.name),
        ['A Newcomer']
      );
      assert.deepEqual(
        res.body.skipped.map((s) => [s.line, s.reason]),
        [
          [1, 'Already in the squad'],
          [3, 'Already in the squad'],
        ]
      );
    });

    it('stops adding when the squad is full', async () => {
      await fillSquad(team, MAX_SQUAD_SIZE - 1);
      const res = await paste('One More, CB, 80\nToo Many, CB, 80');

      assert.deepEqual(
        res.body.added.map((p) => p.name),
        ['One More']
      );
      assert.equal(res.body.skipped[0].reason, 'The squad is full');
      assert.equal(await Footballer.countDocuments({ team: team._id }), MAX_SQUAD_SIZE);
    });

    it('reports a paste with no usable lines without failing', async () => {
      const res = await paste('nothing useful here');

      assert.equal(res.status, 201);
      assert.deepEqual(res.body.added, []);
      assert.equal(res.body.skipped.length, 1);
    });

    it('rejects an empty paste and one that is too long', async () => {
      assert.equal((await paste('  \n ')).status, 400);

      const lines = Array.from({ length: MAX_IMPORT_LINES + 1 }, (_, i) => `Player ${i}, CB, 70`);
      const res = await paste(lines.join('\n'));
      assert.equal(res.status, 400);
      assert.match(res.body.message, /at most 60/);
    });

    it('rejects a body that is not text', async () => {
      assert.equal((await rahimAgent.post(squadUrl('/import')).send({ text: 42 })).status, 400);
      assert.equal((await rahimAgent.post(squadUrl('/import')).send({})).status, 400);
    });

    it('stops other players, and lets an admin through', async () => {
      assert.equal((await paste('A One, GK, 80', sadiaAgent)).status, 403);
      assert.equal(await Footballer.countDocuments(), 0);
      assert.equal((await paste('A One, GK, 80', adminAgent)).status, 201);
    });
  });
});
