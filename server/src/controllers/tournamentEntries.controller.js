import { z } from 'zod';
import Footballer from '../models/Footballer.js';
import Team from '../models/Team.js';
import Tournament from '../models/Tournament.js';
import TournamentEntry from '../models/TournamentEntry.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { onDuplicate } from '../utils/duplicates.js';
import { objectId } from '../utils/schemas.js';

export const MIN_SQUAD_TO_ENTER = 11;
const OPEN_STATUSES = ['pending', 'approved'];
const OPEN = { $in: OPEN_STATUSES };

export const tournamentParams = z.object({ id: objectId });
export const entryParams = z.object({ id: objectId, entryId: objectId });
export const enterSchema = z.object({ teamId: objectId });
export const decisionSchema = z.object({ status: z.enum(['approved', 'rejected']) });
export const seedsSchema = z.object({ order: z.array(objectId).min(1).max(64) });

const withDetails = (query) =>
  query.populate('team', 'name formation').populate('owner', 'name username');

/** `notify` is optional so the entries still work if notifications are not set up. */
export function createEntriesController({ notify = async () => ({}) } = {}) {
  const isAdmin = (req) => req.user.role === 'admin';

  async function loadTournament(req) {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament || (tournament.status === 'draft' && !isAdmin(req))) {
      throw ApiError.notFound('No such competition');
    }
    return tournament;
  }

  async function loadEntry(req, tournament) {
    const entry = await withDetails(
      TournamentEntry.findOne({ _id: req.params.entryId, tournament: tournament._id })
    );
    if (!entry) throw ApiError.notFound('No such entry');
    return entry;
  }

  const requireOpenRegistration = (tournament, message) => {
    if (tournament.status !== 'registration') throw ApiError.conflict(message);
  };

  const list = asyncHandler(async (req, res) => {
    const tournament = await loadTournament(req);
    const filter = { tournament: tournament._id };
    // Everyone sees who is in; the rest is only for admins and the entry's own manager.
    if (!isAdmin(req)) filter.$or = [{ status: 'approved' }, { owner: req.user._id }];

    const items = await withDetails(TournamentEntry.find(filter).sort({ createdAt: 1, _id: 1 }));
    res.json({ success: true, items });
  });

  const enter = asyncHandler(async (req, res) => {
    const tournament = await loadTournament(req);
    requireOpenRegistration(tournament, 'Registration is not open for this competition');
    if (tournament.registrationDeadline && tournament.registrationDeadline < new Date()) {
      throw ApiError.conflict('The registration deadline has passed');
    }

    const team = await Team.findById(req.body.teamId).populate('owner', 'name');
    if (!team) throw ApiError.notFound('No such team');
    const ownerId = String(team.owner._id);
    if (!isAdmin(req) && ownerId !== String(req.user._id)) {
      throw ApiError.forbidden('You can only enter your own team');
    }
    if ((await Footballer.countDocuments({ team: team._id })) < MIN_SQUAD_TO_ENTER) {
      throw ApiError.conflict(`A team needs at least ${MIN_SQUAD_TO_ENTER} players to enter`);
    }

    const existing = await TournamentEntry.findOne({ tournament: tournament._id, team: team._id });
    if (existing && OPEN_STATUSES.includes(existing.status)) {
      throw ApiError.conflict('That team has already entered');
    }
    if (existing?.status === 'rejected') {
      throw ApiError.conflict('That team was not accepted into this competition');
    }
    // One team per manager, so nobody can end up playing themselves.
    if (
      await TournamentEntry.exists({ tournament: tournament._id, owner: ownerId, status: OPEN })
    ) {
      throw ApiError.conflict('This manager already has a team in the competition');
    }
    const taken = await TournamentEntry.countDocuments({
      tournament: tournament._id,
      status: OPEN,
    });
    if (taken >= tournament.maxTeams) throw ApiError.conflict('The competition is full');

    const status = tournament.requiresApproval ? 'pending' : 'approved';
    let entry;
    if (existing) {
      // A team that withdrew can come back.
      existing.set({ status, seed: null });
      existing.decidedBy = undefined;
      existing.decidedAt = undefined;
      entry = await existing.save();
    } else {
      entry = await TournamentEntry.create({
        tournament: tournament._id,
        team: team._id,
        owner: ownerId,
        status,
      }).catch(onDuplicate('That team has already entered'));
    }

    if (status === 'pending') {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
      await notify(
        admins.map((admin) => admin._id),
        {
          type: 'tournament',
          title: `${team.name} wants to join ${tournament.name}`,
          body: `Managed by ${team.owner.name}. It is waiting for your decision.`,
          link: `/tournaments/${tournament.id}`,
        }
      );
    }

    await entry.populate([
      { path: 'team', select: 'name formation' },
      { path: 'owner', select: 'name username' },
    ]);
    res.status(201).json({ success: true, entry });
  });

  const decide = asyncHandler(async (req, res) => {
    const tournament = await loadTournament(req);
    const entry = await loadEntry(req, tournament);
    if (entry.status !== 'pending') {
      throw ApiError.conflict(`This entry is already ${entry.status}`);
    }
    requireOpenRegistration(tournament, 'Registration is not open for this competition');

    const approved = req.body.status === 'approved';
    entry.status = req.body.status;
    entry.decidedBy = req.user._id;
    entry.decidedAt = new Date();
    await entry.save();

    await notify([entry.owner._id], {
      type: 'tournament',
      title: approved
        ? `${entry.team.name} is in ${tournament.name}`
        : `${entry.team.name} was not accepted into ${tournament.name}`,
      link: `/tournaments/${tournament.id}`,
    });

    res.json({ success: true, entry });
  });

  const withdraw = asyncHandler(async (req, res) => {
    const tournament = await loadTournament(req);
    const entry = await loadEntry(req, tournament);
    const mine = String(entry.owner._id) === String(req.user._id);

    if (!isAdmin(req) && !mine) throw ApiError.forbidden('You can only withdraw your own team');
    requireOpenRegistration(tournament, 'Teams can only be removed while registration is open');
    if (!OPEN_STATUSES.includes(entry.status)) {
      throw ApiError.conflict(`This entry is already ${entry.status}`);
    }

    entry.status = 'withdrawn';
    entry.seed = null;
    await entry.save();

    if (!mine) {
      await notify([entry.owner._id], {
        type: 'tournament',
        title: `${entry.team.name} was removed from ${tournament.name}`,
        link: `/tournaments/${tournament.id}`,
      });
    }
    res.json({ success: true, entry });
  });

  const setSeeds = asyncHandler(async (req, res) => {
    const tournament = await loadTournament(req);
    requireOpenRegistration(tournament, 'Seeding can only be set while registration is open');

    const { order } = req.body;
    if (new Set(order).size !== order.length) {
      throw ApiError.badRequest('Each team can appear only once');
    }
    const approved = await TournamentEntry.find({ tournament: tournament._id, status: 'approved' })
      .select('_id')
      .lean();
    const allowed = new Set(approved.map((entry) => String(entry._id)));
    if (!order.every((id) => allowed.has(String(id)))) {
      throw ApiError.badRequest('Only approved teams can be seeded');
    }

    await TournamentEntry.updateMany({ tournament: tournament._id }, { $set: { seed: null } });
    await Promise.all(
      order.map((id, index) =>
        TournamentEntry.updateOne({ _id: id }, { $set: { seed: index + 1 } })
      )
    );

    const items = await withDetails(
      TournamentEntry.find({ tournament: tournament._id, status: 'approved' }).sort({ seed: 1 })
    );
    res.json({ success: true, items });
  });

  return { list, enter, decide, withdraw, setSeeds };
}
