import Team from '../models/Team.js';
import ApiError from '../utils/ApiError.js';

const ownerIdOf = (team) => String(team.owner?._id ?? team.owner);

/** Everyone signed in can look at any team; only its owner or an admin can change it. */
export function assertCanManage(user, team) {
  if (user.role !== 'admin' && ownerIdOf(team) !== String(user._id)) {
    throw ApiError.forbidden('You can only change your own team');
  }
}

/** Loads the team named in the URL, with its owner's name, and checks access for writes. */
export async function loadTeam(req, { write = false } = {}) {
  const team = await Team.findById(req.params.id).populate('owner', 'name username');
  if (!team) throw ApiError.notFound('No such team');
  if (write) assertCanManage(req.user, team);
  return team;
}
