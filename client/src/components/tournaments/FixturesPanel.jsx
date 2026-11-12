import { useState } from 'react';
import { api } from '../../api/client.js';
import { useMatches } from '../../hooks/useMatches.js';
import { groupByRound } from '../../lib/matches.js';
import ConfirmDialog from '../ConfirmDialog.jsx';
import MatchRow from '../matches/MatchRow.jsx';
import { Alert, Button, Card, Spinner } from '../ui/index.jsx';

function Rounds({ tournamentId }) {
  const { status, items, error } = useMatches({ tournament: tournamentId, limit: '500' });
  if (status === 'loading') return <Spinner label="Loading fixtures" />;
  if (status === 'error') return <Alert tone="error">{error.message}</Alert>;

  return (
    <div className="space-y-4">
      {groupByRound(items).map((group) => (
        <Card key={group.round} className="overflow-hidden">
          <h3 className="px-4 py-3 font-display text-lg">{group.name}</h3>
          <ul>
            {group.matches.map((match) => (
              <MatchRow key={match._id} match={match} />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/** Shows the drawn fixtures, and gives admins the draw and withdraw controls. */
export default function FixturesPanel({ tournament, entries, isAdmin, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const drawn = ['active', 'completed'].includes(tournament.status);
  const canDraw = isAdmin && tournament.status === 'registration';
  if (!drawn && !canDraw) return null;

  const approved = entries.filter((entry) => entry.status === 'approved').length;
  const pending = entries.filter((entry) => entry.status === 'pending').length;
  const blocker =
    approved < 2
      ? 'Approve at least two teams to draw the fixtures.'
      : pending > 0
        ? 'Decide the waiting entries before drawing the fixtures.'
        : '';

  const act = (request) => async () => {
    await request();
    setDialog(null);
    onChanged();
  };

  return (
    <section className="space-y-4" aria-labelledby="fixtures-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="fixtures-heading" className="font-display text-2xl">
          Fixtures
        </h2>
        {canDraw && (
          <Button disabled={Boolean(blocker)} onClick={() => setDialog('draw')}>
            Draw fixtures
          </Button>
        )}
        {isAdmin && tournament.status === 'active' && (
          <Button variant="ghost" onClick={() => setDialog('withdraw')}>
            Withdraw fixtures
          </Button>
        )}
      </div>

      {canDraw && blocker && <Alert tone="info">{blocker}</Alert>}
      {drawn && <Rounds tournamentId={tournament._id} />}

      <ConfirmDialog
        open={dialog === 'draw'}
        title={`Draw ${tournament.name}?`}
        confirmLabel="Draw fixtures"
        onConfirm={act(() => api.post(`/tournaments/${tournament._id}/fixtures`))}
        onCancel={() => setDialog(null)}
      >
        Entries close, the competition starts and every manager is told. For a cup, set the seeding
        first.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'withdraw'}
        title="Withdraw the fixtures?"
        confirmLabel="Withdraw"
        tone="danger"
        onConfirm={act(() => api.delete(`/tournaments/${tournament._id}/fixtures`))}
        onCancel={() => setDialog(null)}
      >
        This only works before any match has started. Registration reopens.
      </ConfirmDialog>
    </section>
  );
}
