import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button, Modal } from '../ui/index.jsx';

function CredentialsBody({ name, username, password, onClose }) {
  const [copyState, setCopyState] = useState('idle'); // idle | copied | failed

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <div className="space-y-4">
      <dl className="space-y-3 rounded-lg border border-line bg-turf-900 p-4 text-sm">
        <div>
          <dt className="text-mist">Username</dt>
          <dd className="mt-0.5 font-medium">{username}</dd>
        </div>
        <div>
          <dt className="text-mist">Temporary password</dt>
          <dd className="mt-0.5 flex items-center justify-between gap-3">
            <code className="break-all font-mono text-lg tracking-wide text-flood">{password}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              aria-label={`Copy password for ${name}`}
            >
              {copyState === 'copied' ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
              {copyState === 'copied' ? 'Copied' : 'Copy'}
            </Button>
          </dd>
        </div>
      </dl>

      <p role="status" className="min-h-5 text-xs text-mist">
        {copyState === 'copied' && 'Copied to the clipboard.'}
        {copyState === 'failed' && 'Could not copy automatically. Select the password and copy it.'}
      </p>

      <p className="text-sm text-mist">
        This password is shown <strong className="text-chalk">only once</strong> and is not stored
        anywhere you can read it. Pass it to {name} privately. They must choose their own password
        the first time they sign in.
      </p>

      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

/** Shows a temporary password once, after an account is created or its password is reset. */
export default function CredentialsDialog({ open, reason, name, username, password, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={reason === 'reset' ? 'Password reset' : 'Account created'}
      description={
        reason === 'reset'
          ? `${name} has been signed out everywhere.`
          : `${name} can sign in with these details.`
      }
    >
      <CredentialsBody name={name} username={username} password={password} onClose={onClose} />
    </Modal>
  );
}
