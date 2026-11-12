import { useState } from 'react';
import MatchRow from '../components/matches/MatchRow.jsx';
import { Alert, Button, Card, Spinner } from '../components/ui/index.jsx';
import { useMatches } from '../hooks/useMatches.js';
import { usePageTitle } from '../hooks/usePageTitle.js';

export default function Matches() {
  usePageTitle('Matches');
  const [scope, setScope] = useState('mine');
  const { status, items, error } = useMatches(
    scope === 'mine' ? { mine: 'true', limit: '100' } : { limit: '100' }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl leading-none">Matches</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={scope === 'mine' ? undefined : 'ghost'}
            aria-pressed={scope === 'mine'}
            onClick={() => setScope('mine')}
          >
            My matches
          </Button>
          <Button
            size="sm"
            variant={scope === 'all' ? undefined : 'ghost'}
            aria-pressed={scope === 'all'}
            onClick={() => setScope('all')}
          >
            All matches
          </Button>
        </div>
      </div>

      {status === 'loading' && <Spinner label="Loading matches" />}
      {status === 'error' && <Alert tone="error">{error.message}</Alert>}
      {status === 'ready' &&
        (items.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-mist">
            {scope === 'mine'
              ? 'You have no matches yet. They appear once a competition you are in is drawn.'
              : 'No matches have been scheduled yet.'}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {items.map((match) => (
                <MatchRow key={match._id} match={match} showTournament />
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}
