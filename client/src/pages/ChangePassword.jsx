import { useState } from 'react';
import { useNavigate } from 'react-router';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import { Alert, Button, TextField } from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { PASSWORD_HINT, validatePassword } from '../lib/password.js';

export default function ChangePassword() {
  usePageTitle('Change password');
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const forced = user.mustChangePassword;
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const validate = () => {
    const errors = {};
    const [firstProblem] = validatePassword(form.next);
    if (!form.current) errors.current = 'Enter your current password';
    if (firstProblem) errors.next = firstProblem;
    else if (form.next === form.current) {
      errors.next = 'Choose a password different from your current one';
    }
    if (form.confirm !== form.next) errors.confirm = 'The two passwords do not match';
    return errors;
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      await changePassword(form.current, form.next);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout
      title={forced ? 'Set your own password' : 'Change your password'}
      description={
        forced
          ? 'You are signed in with a temporary password. Replace it before you carry on.'
          : 'Pick something only you know. Other devices will be signed out.'
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Current password"
          type="password"
          value={form.current}
          onChange={update('current')}
          error={fieldErrors.current}
          autoComplete="current-password"
          autoFocus
        />
        <TextField
          label="New password"
          type="password"
          value={form.next}
          onChange={update('next')}
          error={fieldErrors.next}
          hint={PASSWORD_HINT}
          autoComplete="new-password"
        />
        <TextField
          label="Repeat new password"
          type="password"
          value={form.confirm}
          onChange={update('confirm')}
          error={fieldErrors.confirm}
          autoComplete="new-password"
        />
        <Button type="submit" loading={busy} className="w-full">
          Change password
        </Button>
        <div className="text-center">
          <Button variant="link" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
