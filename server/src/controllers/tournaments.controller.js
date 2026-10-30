import { z } from 'zod';
import Tournament, { FORMATS, STATUSES } from '../models/Tournament.js';
import TournamentEntry from '../models/TournamentEntry.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { onDuplicate } from '../utils/duplicates.js';
import { escapeRegex } from '../utils/query.js';
import { NOTHING_TO_CHANGE, atLeastOne, objectId } from '../utils/schemas.js';

const fields = {
  name: z.string().trim().min(2, 'Use at least 2 characters').max(60, 'Use at most 60 characters'),
  description: z.string().trim().max(500),
  format: z.enum(FORMATS),
  legs: z.union([z.literal(1), z.literal(2)]),
  maxTeams: z.number().int().min(2).max(64),
  requiresApproval: z.boolean(),
  registrationDeadline: z.coerce.date().nullable(),
  startsAt: z.coerce.date().nullable(),
};

const optional = (keys) => Object.fromEntries(keys.map((key) => [key, fields[key].optional()]));

/** Rules that look at several fields at once. */
function checkRules(value, ctx) {
  if (value.format === 'knockout' && value.legs === 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['legs'],
      message: 'A knockout cup is played over one leg',
    });
  }
  if (value.registrationDeadline && value.startsAt && value.registrationDeadline > value.startsAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['registrationDeadline'],
      message: 'Registration must close before the competition starts',
    });
  }
}

// zod drops keys that are not listed, so a request can never set `status`, `createdBy` and so on.
export const idParams = z.object({ id: objectId });

export const listQuery = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(STATUSES).optional(),
  format: z.enum(FORMATS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createTournamentSchema = z
  .object({
    name: fields.name,
    format: fields.format,
    maxTeams: fields.maxTeams,
    ...optional(['description', 'legs', 'requiresApproval', 'registrationDeadline', 'startsAt']),
  })
  .superRefine(checkRules);

export const updateTournamentSchema = z
  .object(optional(Object.keys(fields)))
  .refine(atLeastOne, NOTHING_TO_CHANGE)
  .superRefine(checkRules);

// Only these can be asked for. Drawing the fixtures (which makes a competition active) and
// finishing it are done by their own endpoints.
export const statusSchema = z.object({ status: z.enum(['draft', 'registration', 'cancelled']) });

const TRANSITIONS = {
  draft: ['registration', 'cancelled'],
  registration: ['draft', 'cancelled'],
  active: [],
  completed: [],
  cancelled: [],
};

const DUPLICATE_NAME = 'A competition with that name already exists';
const OPEN = { $in: ['pending', 'approved'] };

async function entryCounts(ids) {
  const rows = await TournamentEntry.find({ tournament: { $in: ids }, status: OPEN })
    .select('tournament status')
    .lean();

  const counts = new Map();
  for (const { tournament, status } of rows) {
    const entry = counts.get(String(tournament)) ?? { approved: 0, pending: 0 };
    entry[status] += 1;
    counts.set(String(tournament), entry);
  }
  return counts;
}

const present = (tournament, counts) => ({
  ...tournament.toJSON(),
  entries: counts?.get(String(tournament._id)) ?? { approved: 0, pending: 0 },
});

const isAdmin = (req) => req.user.role === 'admin';

/** Players cannot see a draft: it is not announced yet. */
async function loadTournament(req) {
  const tournament = await Tournament.findById(req.params.id).populate(
    'createdBy',
    'name username'
  );
  if (!tournament || (tournament.status === 'draft' && !isAdmin(req))) {
    throw ApiError.notFound('No such competition');
  }
  return tournament;
}

export const listTournaments = asyncHandler(async (req, res) => {
  const { q, status, format, page, limit } = req.query;
  const filter = {};
  if (format) filter.format = format;
  if (q) filter.nameKey = new RegExp(escapeRegex(q.toLowerCase()));
  if (isAdmin(req)) {
    if (status) filter.status = status;
  } else if (status === 'draft') {
    filter.status = { $in: [] };
  } else {
    filter.status = status ?? { $ne: 'draft' };
  }

  const [tournaments, total] = await Promise.all([
    Tournament.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name username'),
    Tournament.countDocuments(filter),
  ]);
  const counts = await entryCounts(tournaments.map((tournament) => tournament._id));

  res.json({
    success: true,
    items: tournaments.map((tournament) => present(tournament, counts)),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

export const createTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.create({ ...req.body, createdBy: req.user._id }).catch(
    onDuplicate(DUPLICATE_NAME)
  );
  await tournament.populate('createdBy', 'name username');

  res.status(201).json({ success: true, tournament: present(tournament) });
});

export const getTournament = asyncHandler(async (req, res) => {
  const tournament = await loadTournament(req);
  const counts = await entryCounts([tournament._id]);

  res.json({ success: true, tournament: present(tournament, counts) });
});

export const updateTournament = asyncHandler(async (req, res) => {
  const tournament = await loadTournament(req);
  const changes = req.body;

  if (['active', 'completed', 'cancelled'].includes(tournament.status)) {
    throw ApiError.conflict('A competition that has started or ended cannot be edited');
  }
  const changesShape =
    (changes.format !== undefined && changes.format !== tournament.format) ||
    (changes.legs !== undefined && changes.legs !== tournament.legs);
  if (changesShape && tournament.status !== 'draft') {
    throw ApiError.conflict('The format can only be changed while the competition is a draft');
  }
  if (changes.maxTeams !== undefined) {
    const taken = await TournamentEntry.countDocuments({
      tournament: tournament._id,
      status: OPEN,
    });
    if (changes.maxTeams < taken) {
      throw ApiError.conflict(
        `${taken} teams have already entered, so there must be room for them`
      );
    }
  }

  tournament.set(changes);
  const problems = [];
  checkRules(tournament, { addIssue: (issue) => problems.push(issue.message) });
  if (problems.length > 0) throw ApiError.badRequest('Some fields need fixing', problems);

  await tournament.save().catch(onDuplicate(DUPLICATE_NAME));
  const counts = await entryCounts([tournament._id]);
  res.json({ success: true, tournament: present(tournament, counts) });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const tournament = await loadTournament(req);
  const { status } = req.body;

  if (!TRANSITIONS[tournament.status].includes(status)) {
    throw ApiError.conflict(`A ${tournament.status} competition cannot become ${status}`);
  }
  const deadline = tournament.registrationDeadline;
  if (status === 'registration' && deadline && deadline < new Date()) {
    throw ApiError.badRequest('The registration deadline has already passed');
  }
  if (status === 'draft') {
    const taken = await TournamentEntry.countDocuments({
      tournament: tournament._id,
      status: OPEN,
    });
    if (taken > 0) {
      throw ApiError.conflict(
        'Teams have already entered, so it cannot go back to draft. Cancel it instead.'
      );
    }
  }

  tournament.status = status;
  await tournament.save();
  const counts = await entryCounts([tournament._id]);
  res.json({ success: true, tournament: present(tournament, counts) });
});

export const deleteTournament = asyncHandler(async (req, res) => {
  const tournament = await loadTournament(req);
  const hasEntries = await TournamentEntry.exists({ tournament: tournament._id });

  if (tournament.status !== 'draft' || hasEntries) {
    throw ApiError.conflict('Only an empty draft can be deleted. Cancel the competition instead.');
  }
  await tournament.deleteOne();
  res.json({ success: true });
});
