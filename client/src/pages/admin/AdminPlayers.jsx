import { Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import CredentialsDialog from '../../components/admin/CredentialsDialog.jsx';
import PlayerFormDialog from '../../components/admin/PlayerFormDialog.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Pagination from '../../components/Pagination.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  SelectField,
  Spinner,
  TextField,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import { usePlayers } from '../../hooks/usePlayers.js';
import { formatDate } from '../../lib/format.js';

const PAGE_SIZE = 10;
const NO_FILTERS = { search: '', role: '', status: '', page: 1 };

function PlayerRow({ player, isSelf, onEdit, onToggle, onReset }) {
  const selfNote = 'You cannot do this to your own account';

  return (
    <tr className="border-t border-line align-middle">
      <td className="px-4 py-3">
        <p className="font-medium">
          {player.name}
          {isSelf && <span className="ml-2 text-xs font-normal text-mist">(you)</span>}
        </p>
        <p className="text-xs text-mist">
          @{player.username} · {player.email}
        </p>
      </td>
      <td className="px-4 py-3">
        <Badge tone={player.role === 'admin' ? 'gold' : 'neutral'}>
          {player.role === 'admin' ? 'Admin' : 'Player'}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-mist">{player.platform}</td>
      <td className="scoreline px-4 py-3 text-xl">{player.elo}</td>
      <td className="px-4 py-3">
        <Badge tone={player.isActive ? 'green' : 'red'}>
          {player.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-mist">
        {player.lastLoginAt ? formatDate(player.lastLoginAt) : 'Never'}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(player)}
            aria-label={`Edit ${player.name}`}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReset(player)}
            disabled={isSelf}
            title={isSelf ? selfNote : undefined}
            aria-label={`Reset password for ${player.name}`}
          >
            Reset password
          </Button>
          <Button
            variant={player.isActive ? 'danger' : 'ghost'}
            size="sm"
            onClick={() => onToggle(player)}
            disabled={isSelf}
            title={isSelf ? selfNote : undefined}
            aria-label={`${player.isActive ? 'Deactivate' : 'Reactivate'} ${player.name}`}
          >
            {player.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminPlayers() {
  usePageTitle('Players');
  const { user: me, refreshUser } = useAuth();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [dialog, setDialog] = useState(null);

  const search = useDebouncedValue(filters.search.trim());
  const { status, data, error, reload } = usePlayers({
    q: search,
    role: filters.role,
    status: filters.status,
    page: filters.page,
    limit: PAGE_SIZE,
  });

  // Any change to what is being looked for starts again from the first page.
  const setFilter = (field) => (event) =>
    setFilters({ ...filters, [field]: event.target.value, page: 1 });
  const hasFilters = Boolean(filters.search || filters.role || filters.status);
  const closeDialog = () => setDialog(null);

  const created = ({ user, temporaryPassword }) => {
    reload();
    setDialog({
      type: 'credentials',
      reason: 'created',
      name: user.name,
      username: user.username,
      password: temporaryPassword,
    });
  };

  const edited = ({ user }) => {
    reload();
    if (user._id === me._id) refreshUser();
    closeDialog();
  };

  const toggleActive = async () => {
    const { player } = dialog;
    await api.patch(`/users/${player._id}`, { isActive: !player.isActive });
    reload();
    closeDialog();
  };

  const resetPassword = async () => {
    const { player } = dialog;
    const { temporaryPassword } = await api.post(`/users/${player._id}/reset-password`);
    setDialog({
      type: 'credentials',
      reason: 'reset',
      name: player.name,
      username: player.username,
      password: temporaryPassword,
    });
  };

  const players = data?.items ?? [];
  const toggling = dialog?.type === 'toggle' ? dialog.player : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none">Players</h1>
          <p className="mt-2 text-sm text-mist">
            Create accounts, update details and manage who can sign in.
          </p>
        </div>
        <Button onClick={() => setDialog({ type: 'create' })}>
          <UserPlus size={16} aria-hidden="true" />
          Add player
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem_10rem]">
          <TextField
            label="Search players"
            type="search"
            value={filters.search}
            onChange={setFilter('search')}
            placeholder="Name, username or email"
            autoComplete="off"
          />
          <SelectField label="Role" value={filters.role} onChange={setFilter('role')}>
            <option value="">All roles</option>
            <option value="user">Players</option>
            <option value="admin">Admins</option>
          </SelectField>
          <SelectField label="Status" value={filters.status} onChange={setFilter('status')}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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

      {status === 'loading' && !data && <Spinner label="Loading players" />}

      {data && (
        <div className="space-y-3">
          <p aria-live="polite" className="text-sm text-mist">
            {data.total} {data.total === 1 ? 'player' : 'players'}
            {hasFilters && ' match'}
          </p>

          {players.length === 0 ? (
            <Card className="space-y-3 px-6 py-10 text-center">
              <Search size={22} className="mx-auto text-mist" aria-hidden="true" />
              <p className="text-sm text-mist">No players match these filters.</p>
              <div>
                <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                  Clear filters
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Players table"
                tabIndex={0}
                aria-busy={status === 'loading'}
              >
                <table
                  className={`w-full min-w-[56rem] text-left ${status === 'loading' ? 'opacity-60' : ''}`}
                >
                  <caption className="sr-only">Players and their accounts</caption>
                  <thead className="text-xs uppercase tracking-wide text-mist">
                    <tr>
                      {['Player', 'Role', 'Platform', 'Rating', 'Status', 'Last sign-in'].map(
                        (heading) => (
                          <th key={heading} scope="col" className="px-4 py-3 font-medium">
                            {heading}
                          </th>
                        )
                      )}
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <PlayerRow
                        key={player._id}
                        player={player}
                        isSelf={player._id === me._id}
                        onEdit={(target) => setDialog({ type: 'edit', player: target })}
                        onToggle={(target) => setDialog({ type: 'toggle', player: target })}
                        onReset={(target) => setDialog({ type: 'reset', player: target })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            pageSize={PAGE_SIZE}
            onChange={(page) => setFilters({ ...filters, page })}
          />
        </div>
      )}

      <PlayerFormDialog open={dialog?.type === 'create'} onClose={closeDialog} onSaved={created} />
      <PlayerFormDialog
        open={dialog?.type === 'edit'}
        player={dialog?.player}
        isSelf={dialog?.player?._id === me._id}
        onClose={closeDialog}
        onSaved={edited}
      />

      <ConfirmDialog
        open={Boolean(toggling)}
        title={
          toggling?.isActive ? `Deactivate ${toggling.name}?` : `Reactivate ${toggling?.name}?`
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Reactivate'}
        tone={toggling?.isActive ? 'danger' : 'primary'}
        onConfirm={toggleActive}
        onCancel={closeDialog}
      >
        {toggling?.isActive
          ? 'They are signed out straight away and cannot sign in until you reactivate the account. Their matches and stats are kept.'
          : 'They can sign in again with their current password.'}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.type === 'reset'}
        title={`Reset password for ${dialog?.player?.name}?`}
        confirmLabel="Reset password"
        onConfirm={resetPassword}
        onCancel={closeDialog}
      >
        A new temporary password is generated and shown once. They are signed out everywhere and
        must choose their own password the next time they sign in.
      </ConfirmDialog>

      <CredentialsDialog
        open={dialog?.type === 'credentials'}
        reason={dialog?.reason}
        name={dialog?.name}
        username={dialog?.username}
        password={dialog?.password}
        onClose={closeDialog}
      />
    </div>
  );
}
