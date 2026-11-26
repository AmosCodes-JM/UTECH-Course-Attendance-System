import { useEffect, useRef } from 'react';

/**
 * Accessible confirmation prompt built on the native <dialog> element.
 * Used before important actions such as closing a session or deleting data.
 */
export function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', tone = 'primary', busy, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="dialog-body">
        <h2 id="confirm-title">{title}</h2>
        <div className="muted">{children}</div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy} autoFocus>
          {busy && <span className="spinner" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
