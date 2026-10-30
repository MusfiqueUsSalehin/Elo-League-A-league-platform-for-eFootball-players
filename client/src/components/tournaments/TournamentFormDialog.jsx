import { useState } from 'react';
import { api } from '../../api/client.js';
import { fromLocalInput, toLocalInput } from '../../lib/tournaments.js';
import { Alert, Button, Modal, SelectField, TextField } from '../ui/index.jsx';

const sameTime = (a, b) =>
  (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
const TIME_FIELDS = ['registrationDeadline', 'startsAt'];

function TournamentForm({ tournament, onClose, onSaved }) {
  const editing = Boolean(tournament);
  const formatLocked = editing && tournament.status !== 'draft';
  const [form, setForm] = useState({
    name: tournament?.name ?? '',
    description: tournament?.description ?? '',
    format: tournament?.format ?? 'league',
    legs: String(tournament?.legs ?? 1),
    maxTeams: tournament ? String(tournament.maxTeams) : '8',
    requiresApproval: tournament?.requiresApproval ?? true,
    registrationDeadline: toLocalInput(tournament?.registrationDeadline),
    startsAt: toLocalInput(tournament?.startsAt),
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    const name = form.name.trim();
    const maxTeams = Number(form.maxTeams);
    const deadline = fromLocalInput(form.registrationDeadline);
    const starts = fromLocalInput(form.startsAt);

    const found = {};
    if (name.length < 2) found.name = 'Enter a name of at least 2 characters';
    if (!Number.isInteger(maxTeams) || maxTeams < 2 || maxTeams > 64) {
      found.maxTeams = 'Enter a whole number from 2 to 64';
    }
    if (deadline && starts && new Date(deadline) > new Date(starts)) {
      found.registrationDeadline = 'Entries must close before the competition starts';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const values = {
      name,
      description: form.description.trim(),
      format: form.format,
      legs: form.format === 'league' ? Number(form.legs) : 1,
      maxTeams,
      requiresApproval: form.requiresApproval,
      registrationDeadline: deadline,
      startsAt: starts,
    };

    let payload = values;
    if (editing) {
      payload = {};
      for (const [key, value] of Object.entries(values)) {
        const changed = TIME_FIELDS.includes(key)
          ? !sameTime(tournament[key], value)
          : value !== tournament[key];
        if (changed) payload[key] = value;
      }
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
    }

    setBusy(true);
    try {
      const result = editing
        ? await api.patch(`/tournaments/${tournament._id}`, payload)
        : await api.post('/tournaments', payload);
      onSaved(result.tournament);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && (
        <Alert tone="error">
          <p>{error.message}</p>
          {error.details?.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {error.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <TextField
        label="Name"
        value={form.name}
        onChange={update('name')}
        error={errors.name}
        autoComplete="off"
        autoFocus
      />

      <div className="space-y-1.5">
        <label htmlFor="competition-description" className="block text-sm text-mist">
          Description (optional)
        </label>
        <textarea
          id="competition-description"
          value={form.description}
          onChange={update('description')}
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-line bg-turf-900 px-3 py-2 text-sm text-chalk focus:border-flood/60"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Format"
          value={form.format}
          onChange={update('format')}
          disabled={formatLocked}
          hint={formatLocked ? 'The format is fixed once entries are open.' : undefined}
        >
          <option value="league">League</option>
          <option value="knockout">Knockout cup</option>
        </SelectField>
        {form.format === 'league' && (
          <SelectField
            label="Matches"
            value={form.legs}
            onChange={update('legs')}
            disabled={formatLocked}
          >
            <option value="1">Everyone plays everyone once</option>
            <option value="2">Home and away</option>
          </SelectField>
        )}
      </div>

      <TextField
        label="Places"
        type="number"
        inputMode="numeric"
        min={2}
        max={64}
        value={form.maxTeams}
        onChange={update('maxTeams')}
        error={errors.maxTeams}
        autoComplete="off"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Entries close (optional)"
          type="datetime-local"
          value={form.registrationDeadline}
          onChange={update('registrationDeadline')}
          error={errors.registrationDeadline}
        />
        <TextField
          label="Starts (optional)"
          type="datetime-local"
          value={form.startsAt}
          onChange={update('startsAt')}
        />
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={form.requiresApproval}
          onChange={(event) => setForm({ ...form, requiresApproval: event.target.checked })}
          className="h-4 w-4 accent-flood"
        />
        Entries need the admin&rsquo;s approval
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {editing ? 'Save changes' : 'Create competition'}
        </Button>
      </div>
    </form>
  );
}

/** Create a competition (no `tournament` given) or edit one. */
export default function TournamentFormDialog({ open, tournament, onClose, onSaved }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tournament ? 'Edit competition' : 'New competition'}
      description={tournament ? undefined : 'It starts as a draft that only admins can see.'}
    >
      <TournamentForm tournament={tournament} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
