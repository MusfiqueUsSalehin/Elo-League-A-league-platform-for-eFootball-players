import { useState } from 'react';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import { Alert, Button, TextField } from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';

export default function Login() {
  usePageTitle('Sign in');
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(identifier.trim(), password);
      // Signing in changes the session, and the route guard then moves the person along.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Elo League" description="A league platform for eFootball players.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Username or email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" loading={busy} size="lg" className="w-full">
          Sign in
        </Button>
        <p className="text-center text-xs text-mist">
          There is no sign-up. The league admin creates your account.
        </p>
      </form>
    </AuthLayout>
  );
}
