import { useState } from 'react';
import { api } from '../../api/client.js';
import { DEFAULT_FORMATION, FORMATION_KEYS } from '../../lib/formations.js';
import { Alert, Button, Modal, SelectField, TextField } from '../ui/index.jsx';

function TeamForm({ team, onClose, onSaved }) {
  const editing = Boolean(team);
  const [name, setName] = useState(team?.name ?? '');
  const [formation, setFormation] = useState(team?.formation ?? DEFAULT_FORMATION);
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError('Enter a name of at least 2 characters');
      return;
    }
    setNameError('');

    const changes = {};
    if (!editing || trimmed !== team.name) changes.name = trimmed;
    if (!editing || formation !== team.formation) changes.formation = formation;
    if (editing && Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      const result = editing
        ? await api.patch(`/teams/${team._id}`, changes)
        : await api.post('/teams', changes);
      onSaved(result.team);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <TextField
        label="Team name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={nameError}
        autoComplete="off"
        autoFocus
      />
      <SelectField
        label="Formation"
        value={formation}
        onChange={(event) => setFormation(event.target.value)}
      >
        {FORMATION_KEYS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </SelectField>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {editing ? 'Save changes' : 'Create team'}
        </Button>
      </div>
    </form>
  );
}

/** Create a team (no `team` given) or change a team's name and formation. */
export default function TeamFormDialog({ open, team, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={team ? 'Edit team' : 'Create a team'}>
      <TeamForm team={team} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
