import { useState } from 'react';
import { api } from '../../api/client.js';
import { POSITIONS, RATING_MAX, RATING_MIN } from '../../lib/constants.js';
import { Alert, Button, Modal, SelectField, TextField } from '../ui/index.jsx';

function FootballerForm({ teamId, footballer, onClose, onSaved }) {
  const editing = Boolean(footballer);
  const [form, setForm] = useState({
    name: footballer?.name ?? '',
    position: footballer?.position ?? 'CMF',
    rating: footballer ? String(footballer.rating) : '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    const name = form.name.trim();
    const rating = Number(form.rating);
    const found = {};
    if (name.length < 2) found.name = 'Enter a name of at least 2 characters';
    if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
      found.rating = `Enter a whole number from ${RATING_MIN} to ${RATING_MAX}`;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const values = { name, position: form.position, rating };
    const changes = editing
      ? Object.fromEntries(
          Object.entries(values).filter(([key, value]) => value !== footballer[key])
        )
      : values;
    if (editing && Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      await (editing
        ? api.patch(`/teams/${teamId}/squad/${footballer._id}`, changes)
        : api.post(`/teams/${teamId}/squad`, changes));
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <TextField
        label="Player name"
        value={form.name}
        onChange={update('name')}
        error={errors.name}
        autoComplete="off"
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Position" value={form.position} onChange={update('position')}>
          {POSITIONS.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Rating"
          type="number"
          inputMode="numeric"
          min={RATING_MIN}
          max={RATING_MAX}
          value={form.rating}
          onChange={update('rating')}
          error={errors.rating}
          autoComplete="off"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {editing ? 'Save changes' : 'Add to squad'}
        </Button>
      </div>
    </form>
  );
}

/** Add a player to the squad (no `footballer` given) or edit one. */
export default function FootballerFormDialog({ open, teamId, footballer, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={footballer ? 'Edit player' : 'Add a player'}>
      <FootballerForm teamId={teamId} footballer={footballer} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
