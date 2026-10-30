import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EnterTeamDialog from '../components/tournaments/EnterTeamDialog.jsx';
import TournamentFormDialog from '../components/tournaments/TournamentFormDialog.jsx';
import { Alert, Badge, Button, Card, Spinner } from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { useTournament } from '../hooks/useTournament.js';
import { formatDate } from '../lib/format.js';
import {
  ENTRY_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  acceptsEntries,
  deadlineLabel,
  describeFormat,
  teamsLabel,
} from '../lib/tournaments.js';

const OPEN_ENTRY = ['pending', 'approved'];
const ENTRY_TONES = { pending: 'gold', approved: 'green', rejected: 'red', withdrawn: 'neutral' };

const bySeedThenName = (a, b) =>
  (a.seed ?? 999) - (b.seed ?? 999) || a.team.name.localeCompare(b.team.name);

function TournamentPage({ tournamentId }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { status, tournament, entries, error, reload } = useTournament(tournamentId);
  const [dialog, setDialog] = useState(null); // { type, entry? }
  const [actionError, setActionError] = useState('');
  usePageTitle(tournament?.name ?? 'Competition');

  if (status === 'loading') return <Spinner label="Loading competition" />;
  if (status === 'error') {
    return (
      <div className="space-y-4">
        <Alert tone="error">
          {error.status === 404 || error.status === 400
            ? 'That competition does not exist.'
            : error.message}
        </Alert>
        <Button as={Link} to="/tournaments" variant="ghost">
          Back to competitions
        </Button>
      </div>
    );
  }

  const closeDialog = () => setDialog(null);
  const visible = entries.filter((entry) => entry.status !== 'withdrawn').sort(bySeedThenName);
  const hasOpenEntries = entries.some((entry) => OPEN_ENTRY.includes(entry.status));
  const myEntry = entries.find(
    (entry) => entry.owner?._id === user._id && OPEN_ENTRY.includes(entry.status)
  );
  const canEnter = acceptsEntries(tournament) && !myEntry;
  const editable = ['draft', 'registration'].includes(tournament.status);

  const run = async (action) => {
    setActionError('');
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };
  const setStatus = (next) => api.post(`/tournaments/${tournament._id}/status`, { status: next });
  const decide = (entry, next) =>
    api.patch(`/tournaments/${tournament._id}/entries/${entry._id}`, { status: next });

  const confirmAndReload = async (action) => {
    await action();
    closeDialog();
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link to="/tournaments" className="text-sm text-mist hover:text-chalk">
          ← All competitions
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-display text-4xl leading-none">{tournament.name}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-mist">
              <Badge tone={STATUS_TONES[tournament.status]}>
                {STATUS_LABELS[tournament.status]}
              </Badge>
              <span>{describeFormat(tournament)}</span>
              <span>· {teamsLabel(tournament)}</span>
            </p>
            <p className="text-sm text-mist">
              {deadlineLabel(tournament)}
              {tournament.startsAt && ` · Starts ${formatDate(tournament.startsAt)}`}
              {!tournament.requiresApproval && ' · Entries are approved automatically'}
            </p>
            {tournament.description && (
              <p className="max-w-prose text-sm">{tournament.description}</p>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {editable && (
                <Button variant="ghost" size="sm" onClick={() => setDialog({ type: 'edit' })}>
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </Button>
              )}
              {tournament.status === 'draft' && (
                <Button size="sm" onClick={() => run(() => setStatus('registration'))}>
                  Open for entries
                </Button>
              )}
              {tournament.status === 'registration' && !hasOpenEntries && (
                <Button variant="ghost" size="sm" onClick={() => run(() => setStatus('draft'))}>
                  Back to draft
                </Button>
              )}
              {editable && (
                <Button variant="danger" size="sm" onClick={() => setDialog({ type: 'cancel' })}>
                  Cancel competition
                </Button>
              )}
              {tournament.status === 'draft' && entries.length === 0 && (
                <Button variant="danger" size="sm" onClick={() => setDialog({ type: 'delete' })}>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <section aria-label="Teams" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Teams</h2>
          {canEnter && (
            <Button size="sm" onClick={() => setDialog({ type: 'enter' })}>
              Enter a team
            </Button>
          )}
        </div>

        {visible.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-mist">
            No teams have entered yet.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto" role="region" aria-label="Teams table" tabIndex={0}>
              <table className="w-full min-w-[34rem] text-left">
                <caption className="sr-only">Teams in {tournament.name}</caption>
                <thead className="text-xs uppercase tracking-wide text-mist">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Seed
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Team
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Manager
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((entry) => {
                    const mine = entry.owner?._id === user._id;
                    const canWithdraw =
                      tournament.status === 'registration' &&
                      OPEN_ENTRY.includes(entry.status) &&
                      (mine || isAdmin);
                    return (
                      <tr key={entry._id} className="border-t border-line align-middle">
                        <td className="scoreline px-4 py-3 text-lg">{entry.seed ?? '–'}</td>
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/teams/${entry.team._id}`} className="hover:underline">
                            {entry.team.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-mist">{entry.owner?.name}</td>
                        <td className="px-4 py-3">
                          <Badge tone={ENTRY_TONES[entry.status]}>
                            {ENTRY_LABELS[entry.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {isAdmin &&
                              entry.status === 'pending' &&
                              tournament.status === 'registration' && (
                                <>
                                  <Button
                                    size="sm"
                                    aria-label={`Approve ${entry.team.name}`}
                                    onClick={() => run(() => decide(entry, 'approved'))}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Turn down ${entry.team.name}`}
                                    onClick={() => run(() => decide(entry, 'rejected'))}
                                  >
                                    Turn down
                                  </Button>
                                </>
                              )}
                            {canWithdraw && (
                              <Button
                                variant="danger"
                                size="sm"
                                aria-label={`Withdraw ${entry.team.name}`}
                                onClick={() => setDialog({ type: 'withdraw', entry })}
                              >
                                {mine ? 'Withdraw' : 'Remove'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <p className="text-sm text-mist">
        Fixtures and tables will appear here once the competition has been drawn.
      </p>

      <TournamentFormDialog
        open={dialog?.type === 'edit'}
        tournament={tournament}
        onClose={closeDialog}
        onSaved={() => {
          closeDialog();
          reload();
        }}
      />
      <EnterTeamDialog
        open={dialog?.type === 'enter'}
        tournament={tournament}
        onClose={closeDialog}
        onEntered={() => {
          closeDialog();
          reload();
        }}
      />
      <ConfirmDialog
        open={dialog?.type === 'cancel'}
        title={`Cancel ${tournament.name}?`}
        confirmLabel="Cancel competition"
        tone="danger"
        onConfirm={() => confirmAndReload(() => setStatus('cancelled'))}
        onCancel={closeDialog}
      >
        No more teams can enter and it cannot be reopened.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title={`Delete ${tournament.name}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          await api.delete(`/tournaments/${tournament._id}`);
          navigate('/tournaments', { replace: true });
        }}
        onCancel={closeDialog}
      >
        The draft is removed for good.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'withdraw'}
        title={`Take ${dialog?.entry?.team?.name} out of ${tournament.name}?`}
        confirmLabel="Take out"
        tone="danger"
        onConfirm={() =>
          confirmAndReload(() =>
            api.delete(`/tournaments/${tournament._id}/entries/${dialog.entry._id}`)
          )
        }
        onCancel={closeDialog}
      >
        The place is freed for another team. The manager can enter again while entries are open.
      </ConfirmDialog>
    </div>
  );
}

/** Keyed by id so moving between competitions starts fresh. */
export default function Tournament() {
  const { tournamentId } = useParams();
  return <TournamentPage key={tournamentId} tournamentId={tournamentId} />;
}
