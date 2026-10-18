import { useState } from 'react';
import { api } from '../../api/client.js';
import { POSITIONS } from '../../lib/constants.js';
import { Alert, Button, Modal } from '../ui/index.jsx';

const EXAMPLE = 'Lionel Messi, RWF, 99\nKylian Mbappe, CF, 98\nAlisson Becker, GK, 90';

function ImportForm({ teamId, onImported, onClose }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.post(`/teams/${teamId}/squad/import`, { text });
      setResult(data);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <Alert tone={result.added.length > 0 ? 'success' : 'info'}>
          {result.added.length === 1 ? '1 player added.' : `${result.added.length} players added.`}
        </Alert>
        {result.skipped.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-mist">
              {result.skipped.length === 1
                ? '1 line was skipped:'
                : `${result.skipped.length} lines were skipped:`}
            </p>
            <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-line bg-turf-900 p-3 text-sm">
              {result.skipped.map((item) => (
                <li key={`${item.line}-${item.text}`}>
                  <span className="text-mist">Line {item.line}:</span> {item.reason}
                  <span className="block truncate text-xs text-mist">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="space-y-1.5">
        <label htmlFor="squad-text" className="block text-sm text-mist">
          Squad list
        </label>
        <textarea
          id="squad-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={EXAMPLE}
          aria-describedby="squad-text-hint"
          className="w-full rounded-lg border border-line bg-turf-900 px-3 py-2 font-mono text-sm text-chalk placeholder:text-mist/50 focus:border-flood/60"
        />
        <p id="squad-text-hint" className="text-xs text-mist/80">
          One player per line: name, position, rating. Positions: {POSITIONS.join(', ')}. Players
          already in the squad are skipped.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!text.trim()}>
          Add players
        </Button>
      </div>
    </form>
  );
}

/** Paste a whole squad at once. Shows what was added and what had to be skipped, and why. */
export default function ImportSquadDialog({ open, teamId, onImported, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Paste a squad">
      <ImportForm teamId={teamId} onImported={onImported} onClose={onClose} />
    </Modal>
  );
}
