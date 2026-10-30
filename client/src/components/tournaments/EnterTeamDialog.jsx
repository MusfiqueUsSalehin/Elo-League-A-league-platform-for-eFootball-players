import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client.js';
import { Alert, Button, Modal, SelectField, Spinner } from '../ui/index.jsx';

function EnterForm({ tournament, onClose, onEntered }) {
  const [teams, setTeams] = useState({ status: 'loading', items: [], error: '' });
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    api
      .get('/teams?mine=true&limit=50')
      .then((data) => {
        if (!current) return;
        setTeams({ status: 'ready', items: data.items, error: '' });
        setTeamId(data.items[0]?._id ?? '');
      })
      .catch((err) => current && setTeams({ status: 'error', items: [], error: err.message }));
    return () => {
      current = false;
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api.post(`/tournaments/${tournament._id}/entries`, { teamId });
      onEntered(result.entry);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (teams.status === 'loading') return <Spinner label="Loading your teams" className="py-8" />;
  if (teams.status === 'error') return <Alert tone="error">{teams.error}</Alert>;

  if (teams.items.length === 0) {
    return (
      <div className="space-y-4 text-sm text-mist">
        <p>You do not have a team yet. Create one, give it at least 11 players, then come back.</p>
        <div className="flex justify-end">
          <Button as={Link} to="/teams">
            Go to my teams
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <SelectField
        label="Your team"
        value={teamId}
        onChange={(event) => setTeamId(event.target.value)}
        hint={
          tournament.requiresApproval
            ? 'The admin has to approve your entry. A team needs at least 11 players.'
            : 'A team needs at least 11 players.'
        }
      >
        {teams.items.map((team) => (
          <option key={team._id} value={team._id}>
            {team.name} ({team.squadSize} players)
          </option>
        ))}
      </SelectField>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Enter team
        </Button>
      </div>
    </form>
  );
}

/** Lets a manager pick one of their teams to enter into a competition. */
export default function EnterTeamDialog({ open, tournament, onClose, onEntered }) {
  return (
    <Modal open={open} onClose={onClose} title={`Enter ${tournament.name}`}>
      <EnterForm tournament={tournament} onClose={onClose} onEntered={onEntered} />
    </Modal>
  );
}
