import { Plus, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Pagination from '../components/Pagination.jsx';
import TournamentFormDialog from '../components/tournaments/TournamentFormDialog.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  SelectField,
  Spinner,
  TextField,
} from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useList } from '../hooks/useList.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import {
  STATUS_LABELS,
  STATUS_TONES,
  deadlineLabel,
  describeFormat,
  teamsLabel,
} from '../lib/tournaments.js';

const PAGE_SIZE = 12;

export default function Tournaments() {
  usePageTitle('Competitions');
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', status: '', format: '', page: 1 });
  const [creating, setCreating] = useState(false);

  const search = useDebouncedValue(filters.search.trim());
  const { status, data, error, reload } = useList('/tournaments', {
    q: search,
    status: filters.status,
    format: filters.format,
    page: filters.page,
    limit: PAGE_SIZE,
  });

  const setFilter = (field) => (event) =>
    setFilters({ ...filters, [field]: event.target.value, page: 1 });
  const items = data?.items ?? [];
  const statuses = Object.keys(STATUS_LABELS).filter((key) => isAdmin || key !== 'draft');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none">Competitions</h1>
          <p className="mt-2 text-sm text-mist">
            Leagues and cups. Enter a team while entries are open.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            New competition
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_12rem]">
          <TextField
            label="Search competitions"
            type="search"
            value={filters.search}
            onChange={setFilter('search')}
            autoComplete="off"
          />
          <SelectField label="Status" value={filters.status} onChange={setFilter('status')}>
            <option value="">Any status</option>
            {statuses.map((key) => (
              <option key={key} value={key}>
                {STATUS_LABELS[key]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Format" value={filters.format} onChange={setFilter('format')}>
            <option value="">Any format</option>
            <option value="league">League</option>
            <option value="knockout">Knockout cup</option>
          </SelectField>
        </div>
      </Card>

      {status === 'error' && (
        <Alert tone="error">
          <p>{error}</p>
          <Button variant="link" className="mt-1" onClick={reload}>
            Try again
          </Button>
        </Alert>
      )}

      {status === 'loading' && !data && <Spinner label="Loading competitions" />}

      {data &&
        (items.length === 0 ? (
          <Card className="space-y-2 px-6 py-10 text-center">
            <Trophy size={24} className="mx-auto text-mist" aria-hidden="true" />
            <p className="text-sm text-mist">No competitions yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <li key={item._id}>
                  <Link to={`/tournaments/${item._id}`} className="block rounded-xl">
                    <Card className="h-full space-y-2 p-4 transition-colors hover:border-flood/40">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-display text-2xl leading-tight">{item.name}</h2>
                        <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                      </div>
                      <p className="text-sm text-mist">{describeFormat(item)}</p>
                      <p className="text-sm">{teamsLabel(item)}</p>
                      <p className="text-xs text-mist">{deadlineLabel(item)}</p>
                    </Card>
                  </Link>
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

      <TournamentFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(tournament) => navigate(`/tournaments/${tournament._id}`)}
      />
    </div>
  );
}
