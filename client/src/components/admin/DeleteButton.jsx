import { useState } from 'react';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { useToast } from '../../hooks/useToast.js';

/** "Delete" / "Remove" button that asks for confirmation first. */
export function DeleteButton({ label = 'Delete', title, children, onDelete, onDone, successMessage = 'Deleted.' }) {
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onDelete();
      notify.success(successMessage);
      setOpen(false);
      await onDone?.();
    } catch (error) {
      notify.error(error.message, 'Could not complete that');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => setOpen(true)}>
        {label}
      </button>
      <ConfirmDialog open={open} title={title} confirmLabel={label} tone="danger" busy={busy} onConfirm={confirm} onCancel={() => setOpen(false)}>
        {children}
      </ConfirmDialog>
    </>
  );
}
