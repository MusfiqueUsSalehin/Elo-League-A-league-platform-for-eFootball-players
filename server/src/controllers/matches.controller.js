import { z } from 'zod';
import Match, { MATCH_STATUSES } from '../models/Match.js';
import Tournament from '../models/Tournament.js';
import TournamentEntry from '../models/TournamentEntry.js';
import { buildKnockout, buildLeague, withDates } from '../services/fixtures.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { objectId } from '../utils/schemas.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const idParams = z.object({ id: objectId });

export const listQuery = z.object({
  tournament: objectId.optional(),
  team: objectId.optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  mine: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const rescheduleSchema = z.object({
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'Pick a time in the future'),
});

export const drawSchema = z.object({ intervalDays: z.number().int().min(1).max(14).default(2) });

const bySeed = (a, b) => (a.seed ?? 999) - (b.seed ?? 999) || a.createdAt - b.createdAt;

const withPeople = (query) =>
  query
    .populate('tournament', 'name format')
    .populate('homeTeam awayTeam', 'name')
    .populate('homeUser awayUser', 'name username');

/** A start time in the future: the competition's own, or tomorrow on the next full hour. */
function firstKickoff(tournament, now = Date.now()) {
  if (tournament.startsAt && tournament.startsAt.getTime() > now) return tournament.startsAt;
  return new Date(Math.ceil((now + DAY_MS) / HOUR_MS) * HOUR_MS);
}

export function createMatchesController({ notify = async () => ({}) } = {}) {
  async function loadTournament(req) {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) throw ApiError.notFound('No such competition');
    return tournament;
  }

  const list = asyncHandler(async (req, res) => {
    const { tournament, team, status, mine, page, limit } = req.query;
    const filter = {};
    const and = [];
    if (tournament) filter.tournament = tournament;
    if (status) filter.status = status;
    if (team) and.push({ $or: [{ homeTeam: team }, { awayTeam: team }] });
    if (mine === 'true') {
      and.push({ $or: [{ homeUser: req.user._id }, { awayUser: req.user._id }] });
    }
    if (and.length > 0) filter.$and = and;

    const sort = tournament ? { round: 1, number: 1 } : { scheduledAt: 1, _id: 1 };
    const [items, total] = await Promise.all([
      withPeople(
        Match.find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
      ),
      Match.countDocuments(filter),
    ]);
    res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
  });

  const get = asyncHandler(async (req, res) => {
    const match = await withPeople(Match.findById(req.params.id));
    if (!match) throw ApiError.notFound('No such match');
    res.json({ success: true, match });
  });

  const reschedule = asyncHandler(async (req, res) => {
    const match = await withPeople(Match.findById(req.params.id));
    if (!match) throw ApiError.notFound('No such match');
    if (match.status !== 'scheduled') {
      throw ApiError.conflict('Only a match that has not started can be moved');
    }

    match.scheduledAt = req.body.scheduledAt;
    await match.save();

    const people = [match.homeUser?._id, match.awayUser?._id].filter(Boolean);
    await notify(people, {
      type: 'match',
      title: `Kick-off moved: ${match.homeTeam?.name} v ${match.awayTeam?.name}`,
      body: 'Check the new time on the competition page.',
      link: `/tournaments/${match.tournament._id}`,
    });
    res.json({ success: true, match });
  });

  const draw = asyncHandler(async (req, res) => {
    const tournament = await loadTournament(req);
    if (tournament.status !== 'registration') {
      throw ApiError.conflict('Fixtures can only be drawn while registration is open');
    }

    const entries = await TournamentEntry.find({
      tournament: tournament._id,
      status: { $in: ['pending', 'approved'] },
    }).lean();
    if (entries.some((entry) => entry.status === 'pending')) {
      throw ApiError.conflict('Decide the waiting entries before drawing the fixtures');
    }
    const approved = entries.sort(bySeed);
    if (approved.length < 2) throw ApiError.conflict('At least 2 approved teams are needed');

    const drawn =
      tournament.format === 'knockout'
        ? buildKnockout(approved)
        : buildLeague(approved, { legs: tournament.legs });
    const docs = withDates(drawn, firstKickoff(tournament), req.body.intervalDays).map((match) => ({
      ...match,
      tournament: tournament._id,
    }));

    // Claim the competition first, so two admins drawing at once cannot both succeed.
    const claimed = await Tournament.findOneAndUpdate(
      { _id: tournament._id, status: 'registration' },
      { $set: { status: 'active' } },
      { new: true }
    );
    if (!claimed) throw ApiError.conflict('Fixtures can only be drawn while registration is open');

    try {
      await Match.insertMany(docs);
    } catch (err) {
      await Match.deleteMany({ tournament: tournament._id });
      await Tournament.updateOne({ _id: tournament._id }, { $set: { status: 'registration' } });
      throw err;
    }

    await notify(
      approved.map((entry) => entry.owner),
      {
        type: 'match',
        title: `${tournament.name}: the fixtures are out`,
        body: 'See who you play and when.',
        link: `/tournaments/${tournament.id}`,
      }
    );
    res.status(201).json({ success: true, tournament: claimed, matches: docs.length });
  });

  const clear = asyncHandler(async (req, res) => {
    const tournament = await loadTournament(req);
    if (tournament.status !== 'active')
      throw ApiError.conflict('There are no fixtures to withdraw');
    if (await Match.exists({ tournament: tournament._id, status: { $ne: 'scheduled' } })) {
      throw ApiError.conflict('Some matches have already started, so the fixtures are locked');
    }

    await Match.deleteMany({ tournament: tournament._id });
    tournament.status = 'registration';
    await tournament.save();

    const owners = await TournamentEntry.find({
      tournament: tournament._id,
      status: 'approved',
    }).distinct('owner');
    await notify(owners, {
      type: 'tournament',
      title: `${tournament.name}: the fixtures were withdrawn`,
      body: 'The draw will be redone.',
      link: `/tournaments/${tournament.id}`,
    });
    res.json({ success: true });
  });

  return { list, get, reschedule, draw, clear };
}
