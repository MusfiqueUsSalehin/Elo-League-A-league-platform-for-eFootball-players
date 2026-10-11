import { useState } from 'react';
import { Alert, Button, Modal } from './ui/index.jsx';

function ConfirmBody({ confirmLabel, tone, onConfirm, onCancel, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      // On success the page closes this dialog, so there is nothing more to do here.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-mist">{children}</div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={tone} loading={busy} onClick={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

/** Asks before something with consequences. `onConfirm` may be async and may throw. */
export default function ConfirmDialog({
  open,
  title,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <ConfirmBody
        confirmLabel={confirmLabel}
        tone={tone}
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        {children}
      </ConfirmBody>
    </Modal>
  );
}
