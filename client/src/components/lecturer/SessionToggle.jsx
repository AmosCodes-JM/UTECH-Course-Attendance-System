import { useState } from 'react';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { formatTime } from '../common/format.js';
import { Spinner } from '../common/Spinner.jsx';
import { useToast } from '../../hooks/useToast.js';
import { lecturerApi } from '../../services/endpoints.js';

/**
 * Open / close the attendance session for one course. Closing asks for
 * confirmation because students can no longer check in afterwards.
 * Sessions never close automatically.
 */
export function SessionToggle({ course, onChanged }) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const open = course.openSession;

  async function openSession() {
    setBusy(true);
    try {
      await lecturerApi.openSession(course.id);
      notify.success(`Students can now check in to ${course.code}.`, 'Session opened');
      await onChanged();
    } catch (error) {
      notify.error(error.message, 'Could not open the session');
    } finally {
      setBusy(false);
    }
  }

  async function closeSession() {
    setBusy(true);
    try {
      const closed = await lecturerApi.closeSession(open.id);
      notify.success(`${closed.attendanceCount} student(s) checked in.`, `${course.code} session closed`);
      setConfirming(false);
      await onChanged();
    } catch (error) {
      notify.error(error.message, 'Could not close the session');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-success" onClick={openSession} disabled={busy}>
        {busy && <Spinner label="Opening session" />}
        Open session
      </button>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)} disabled={busy}>
        Close session
      </button>
      <ConfirmDialog
        open={confirming}
        title={`Close the ${course.code} session?`}
        confirmLabel="Close session"
        tone="danger"
        busy={busy}
        onConfirm={closeSession}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Opened at {formatTime(open.openedAt)} · {open.attendanceCount} checked in so far.
        </p>
        <p style={{ marginBottom: 0 }}>Students will no longer be able to check in to this session.</p>
      </ConfirmDialog>
    </>
  );
}
