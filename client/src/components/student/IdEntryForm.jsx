import { useState } from 'react';
import { Spinner } from '../common/Spinner.jsx';

const ID_PATTERN = /^[A-Za-z0-9-]{4,20}$/;

/** Step 1 of check-in: the student types their ID number. */
export function IdEntryForm({ initialValue = '', busy, onSubmit }) {
  const [idNumber, setIdNumber] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const value = idNumber.trim();
  const invalid = touched && !ID_PATTERN.test(value);

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (ID_PATTERN.test(value)) onSubmit(value.toUpperCase());
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="student-id" className="visually-hidden">
          Student ID number
        </label>
        <input
          id="student-id"
          className="input input-lg"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Student ID number"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={invalid ? 'student-id-error' : undefined}
          maxLength={20}
          autoFocus
          disabled={busy}
        />
        {invalid && (
          <span className="error" id="student-id-error" role="alert">
            Enter your student ID (4–20 letters or digits).
          </span>
        )}
      </div>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <Spinner label="Looking up your ID" /> : null}
        {busy ? 'Looking you up…' : 'Continue'}
      </button>
    </form>
  );
}
