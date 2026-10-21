import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { NOTIFICATION_TYPES } from '../../lib/notifications.js';
import { Alert, Button, Card, Spinner } from '../ui/index.jsx';

/** One switch per kind of notification: does this kind also arrive by email? */
export default function EmailPreferences() {
  const [state, setState] = useState({ status: 'loading', prefs: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let current = true;
    setState({ status: 'loading', prefs: null, error: '' });
    api
      .get('/notifications/preferences')
      .then((data) => current && setState({ status: 'ready', prefs: data.email, error: '' }))
      .catch((err) => current && setState({ status: 'error', prefs: null, error: err.message }));
    return () => {
      current = false;
    };
  }, [attempt]);

  const toggle = async (key) => {
    const next = !state.prefs[key];
    setSaveError('');
    // Show the change straight away, and put it back if the server says no.
    setState((previous) => ({ ...previous, prefs: { ...previous.prefs, [key]: next } }));
    try {
      await api.put('/notifications/preferences', { email: { [key]: next } });
    } catch (err) {
      setState((previous) => ({ ...previous, prefs: { ...previous.prefs, [key]: !next } }));
      setSaveError(err.message);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="font-display text-xl">Email</h2>
      <p className="mt-1 text-sm text-mist">
        Choose which notifications also reach you by email. You always see them here.
      </p>

      {state.status === 'loading' && <Spinner label="Loading email settings" className="py-8" />}

      {state.status === 'error' && (
        <div className="mt-3 space-y-2">
          <Alert tone="error">{state.error}</Alert>
          <Button variant="ghost" size="sm" onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </Button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          {saveError && (
            <Alert tone="error" className="mt-3">
              {saveError}
            </Alert>
          )}
          <ul className="mt-2 divide-y divide-line">
            {NOTIFICATION_TYPES.map(({ key, label, hint }) => (
              <li key={key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <label htmlFor={`email-${key}`} className="text-sm font-medium">
                    {label}
                  </label>
                  <p id={`email-${key}-hint`} className="text-xs text-mist">
                    {hint}
                  </p>
                </div>
                <input
                  id={`email-${key}`}
                  type="checkbox"
                  role="switch"
                  checked={state.prefs[key]}
                  aria-describedby={`email-${key}-hint`}
                  onChange={() => toggle(key)}
                  className="h-5 w-5 shrink-0 accent-flood"
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
