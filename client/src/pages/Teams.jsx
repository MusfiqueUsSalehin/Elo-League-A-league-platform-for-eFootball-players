import { Plus, Shield } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Pagination from '../components/Pagination.jsx';
import TeamFormDialog from '../components/teams/TeamFormDialog.jsx';
import { Alert, Badge, Button, Card, Spinner, TextField, cx } from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useList } from '../hooks/useList.js';
import { usePageTitle } from '../hooks/usePageTitle.js';

const PAGE_SIZE = 12;

function ScopeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'rounded-lg px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-turf-600 text-chalk' : 'text-mist hover:text-chalk'
      )}
    >
      {children}
    </button>
  );
}

function TeamCard({ team, mine }) {
  return (
    <Link to={`/teams/${team._id}`} className="block rounded-xl">
      <Card className="h-full space-y-3 p-4 transition-colors hover:border-flood/40">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-tight">{team.name}</h2>
          {mine && <Badge tone="gold">Yours</Badge>}
        </div>
        <p className="text-sm text-mist">Managed by {team.owner?.name}</p>
        <div className="flex items-center justify-between text-sm">
          <Badge>{team.formation}</Badge>
          <span className="text-mist">
            {team.squadSize} {team.squadSize === 1 ? 'player' : 'players'}
            {team.squadSize > 0 && ` · ${team.squadRating} avg`}
          </span>
        </div>
      </Card>
    </Link>
  );
}

export default function Teams() {
  usePageTitle('Teams');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ scope: 'mine', search: '', page: 1 });
  const [creating, setCreating] = useState(false);

  const search = useDebouncedValue(filters.search.trim());
  const { status, data, error, reload } = useList('/teams', {
    mine: filters.scope === 'mine' ? 'true' : '',
    q: search,
    page: filters.page,
    limit: PAGE_SIZE,
  });

  const change = (changes) => setFilters({ ...filters, ...changes, page: 1 });
  const teams = data?.items ?? [];
  const nothingYet = data && data.total === 0 && !filters.search && filters.scope === 'mine';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none">Teams</h1>
          <p className="mt-2 text-sm text-mist">Squads, formations and starting line-ups.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden="true" />
          New team
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div
          role="group"
          aria-label="Which teams"
          className="flex rounded-xl border border-line p-1"
        >
          <ScopeButton active={filters.scope === 'mine'} onClick={() => change({ scope: 'mine' })}>
            My teams
          </ScopeButton>
          <ScopeButton active={filters.scope === 'all'} onClick={() => change({ scope: 'all' })}>
            All teams
          </ScopeButton>
        </div>
        <TextField
          className="min-w-56 flex-1"
          label="Search teams"
          type="search"
          value={filters.search}
          onChange={(event) => change({ search: event.target.value })}
          autoComplete="off"
        />
      </div>

      {status === 'error' && (
        <Alert tone="error">
          <p>{error}</p>
          <Button variant="link" className="mt-1" onClick={reload}>
            Try again
          </Button>
        </Alert>
      )}

      {status === 'loading' && !data && <Spinner label="Loading teams" />}

      {data &&
        (teams.length === 0 ? (
          <Card className="space-y-3 px-6 py-10 text-center">
            <Shield size={24} className="mx-auto text-mist" aria-hidden="true" />
            <p className="text-sm text-mist">
              {nothingYet ? 'You do not have a team yet.' : 'No teams match.'}
            </p>
            {nothingYet && (
              <Button onClick={() => setCreating(true)}>Create your first team</Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <li key={team._id}>
                  <TeamCard team={team} mine={team.owner?._id === user._id} />
                </li>
              ))}
            </ul>
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              pageSize={PAGE_SIZE}
              onChange={(page) => setFilters({ ...filters, page })}
            />
          </div>
        ))}

      <TeamFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(team) => navigate(`/teams/${team._id}`)}
      />
    </div>
  );
}
