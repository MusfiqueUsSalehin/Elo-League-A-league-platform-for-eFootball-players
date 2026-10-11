import { useState } from 'react';
import { api } from '../../api/client.js';
import { PLATFORMS, ROLES } from '../../lib/constants.js';
import { Alert, Button, Modal, SelectField, TextField } from '../ui/index.jsx';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const trimmed = (form) => ({
  ...form,
  name: form.name.trim(),
  username: form.username.trim(),
  email: form.email.trim(),
  konamiId: form.konamiId.trim(),
  phone: form.phone.trim(),
});

function validate(form) {
  const errors = {};
  if (form.name.length < 2) errors.name = 'Enter a name of at least 2 characters';
  if (!USERNAME_PATTERN.test(form.username)) {
    errors.username = 'Use 3-30 letters, numbers, dots, dashes or underscores';
  }
  if (!EMAIL_PATTERN.test(form.email)) errors.email = 'Enter a valid email address';
  return errors;
}

/** Only the fields that differ from the saved player, so an edit never rewrites the rest. */
function changesTo(player, form) {
  const changes = {};
  for (const field of ['name', 'role', 'platform', 'konamiId', 'phone']) {
    if (form[field] !== (player[field] ?? '')) changes[field] = form[field];
  }
  // The server stores these in lower case, so a change of case alone is not a change.
  for (const field of ['username', 'email']) {
    if (form[field].toLowerCase() !== player[field]) changes[field] = form[field];
  }
  return changes;
}

function newPlayerFrom(form) {
  const payload = {
    name: form.name,
    username: form.username,
    email: form.email,
    role: form.role,
    platform: form.platform,
  };
  if (form.konamiId) payload.konamiId = form.konamiId;
  if (form.phone) payload.phone = form.phone;
  return payload;
}

function PlayerForm({ player, isSelf, onClose, onSaved }) {
  const editing = Boolean(player);
  const [form, setForm] = useState({
    name: player?.name ?? '',
    username: player?.username ?? '',
    email: player?.email ?? '',
    role: player?.role ?? 'user',
    platform: player?.platform ?? 'Mobile',
    konamiId: player?.konamiId ?? '',
    phone: player?.phone ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError(null);

    const values = trimmed(form);
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const changes = editing ? changesTo(player, values) : null;
    if (editing && Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      const result = editing
        ? await api.patch(`/users/${player._id}`, changes)
        : await api.post('/users', newPlayerFrom(values));
      onSaved(result);
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
        label="Full name"
        value={form.name}
        onChange={update('name')}
        error={fieldErrors.name}
        autoComplete="off"
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Username"
          value={form.username}
          onChange={update('username')}
          error={fieldErrors.username}
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Platform" value={form.platform} onChange={update('platform')}>
          {PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Role"
          value={form.role}
          onChange={update('role')}
          disabled={isSelf}
          hint={isSelf ? 'You cannot change your own role.' : undefined}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role === 'admin' ? 'Admin' : 'Player'}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Konami ID (optional)"
          value={form.konamiId}
          onChange={update('konamiId')}
          autoComplete="off"
        />
        <TextField
          label="Phone (optional)"
          type="tel"
          value={form.phone}
          onChange={update('phone')}
          autoComplete="off"
        />
      </div>

      {!editing && (
        <p className="text-xs text-mist">
          A temporary password is generated for you and shown once after the account is created.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {editing ? 'Save changes' : 'Create account'}
        </Button>
      </div>
    </form>
  );
}

/** Create a player (no `player` given) or edit one. */
export default function PlayerFormDialog({ open, player, isSelf, onClose, onSaved }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={player ? 'Edit player' : 'Add a player'}
      description={player ? player.name : 'They sign in with the temporary password you hand over.'}
    >
      <PlayerForm player={player} isSelf={isSelf} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
