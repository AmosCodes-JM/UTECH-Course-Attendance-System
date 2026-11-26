import { formatTime } from '../common/format.js';

/** Step 4: big, unmistakable confirmation, then the kiosk resets itself. */
export function CheckInConfirmation({ firstName, result, secondsLeft, totalSeconds, onDone }) {
  return (
    <div className="confirmation" role="status" aria-live="assertive">
      <div className="tick" aria-hidden="true">
        ✓
      </div>
      <h1>You’re checked in{firstName ? `, ${firstName}` : ''}!</h1>
      <p className="kiosk-lead">
        <strong>
          {result.course.code} – {result.course.name}
        </strong>
        <br />
        Recorded at {formatTime(result.checkedInAt)}
      </p>
      <button type="button" className="btn btn-success btn-lg" onClick={onDone}>
        Done
      </button>
      <p className="muted" style={{ marginTop: '1rem' }}>
        This screen resets in {secondsLeft} second{secondsLeft === 1 ? '' : 's'}.
      </p>
      <div className="countdown-bar" aria-hidden="true">
        <span style={{ width: `${(secondsLeft / totalSeconds) * 100}%` }} />
      </div>
    </div>
  );
}
