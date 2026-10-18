import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client.js';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import TeamFormDialog from '../../components/teams/TeamFormDialog.jsx';
import { Alert, Badge, Button, Spinner, cx } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import { useTeam } from '../../hooks/useTeam.js';

const tabClass = ({ isActive }) =>
  cx(
    'rounded-lg px-3 py-1.5 text-sm transition-colors',
    isActive ? 'bg-turf-600 text-chalk' : 'text-mist hover:text-chalk'
  );

function TeamPage({ teamId }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { status, team, squad, error, reload } = useTeam(teamId);
  const [dialog, setDialog] = useState(null); // 'edit' | 'delete' | null
  usePageTitle(team?.name ?? 'Team');

  if (status === 'loading') return <Spinner label="Loading team" />;
  if (status === 'error') {
    return (
      <div className="space-y-4">
        <Alert tone="error">
          {error.status === 404 || error.status === 400
            ? 'That team does not exist.'
            : error.message}
        </Alert>
        <Button as={Link} to="/teams" variant="ghost">
          Back to teams
        </Button>
      </div>
    );
  }

  const canEdit = isAdmin || team.owner?._id === user._id;
  const closeDialog = () => setDialog(null);

  const deleteTeam = async () => {
    await api.delete(`/teams/${team._id}`);
    navigate('/teams', { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link to="/teams" className="text-sm text-mist hover:text-chalk">
          ← All teams
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl leading-none">{team.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-mist">
              <span>Managed by {team.owner?.name}</span>
              <Badge>{team.formation}</Badge>
              {team.squadSize > 0 && <span>{team.squadRating} average rating</span>}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDialog('edit')}>
                <Pencil size={14} aria-hidden="true" />
                Edit team
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDialog('delete')}>
                <Trash2 size={14} aria-hidden="true" />
                Delete team
              </Button>
            </div>
          )}
        </div>
      </div>

      <nav aria-label="Team sections" className="flex gap-1 border-b border-line pb-3">
        <NavLink to={`/teams/${team._id}`} end className={tabClass}>
          Squad
        </NavLink>
        <NavLink to={`/teams/${team._id}/lineup`} className={tabClass}>
          Line-up
        </NavLink>
      </nav>

      <Outlet context={{ team, squad, canEdit, reload }} />

      <TeamFormDialog
        open={dialog === 'edit'}
        team={team}
        onClose={closeDialog}
        onSaved={() => {
          closeDialog();
          reload();
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={`Delete ${team.name}?`}
        confirmLabel="Delete team"
        tone="danger"
        onConfirm={deleteTeam}
        onCancel={closeDialog}
      >
        The team and its whole squad are removed for good.
      </ConfirmDialog>
    </div>
  );
}

/** Loads the team named in the address. Keyed by id so moving between teams starts fresh. */
export default function TeamLayout() {
  const { teamId } = useParams();
  return <TeamPage key={teamId} teamId={teamId} />;
}
