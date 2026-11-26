import { useState } from 'react';
import { ErrorAlert } from '../common/Alert.jsx';
import { FormField } from '../common/FormField.jsx';
import { Spinner } from '../common/Spinner.jsx';

/** Shared email/work-ID + password form used by both login systems. */
export function LoginForm({ portalLabel, onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError({ message: 'Enter your email or work ID and your password.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onLogin(identifier.trim(), password);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <ErrorAlert error={error} title="Sign-in failed" />
      <FormField id="identifier" label="Email or work ID">
        <input
          id="identifier"
          className="input"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoFocus
        />
      </FormField>
      <FormField id="password" label="Password">
        <input
          id="password"
          type="password"
          className="input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </FormField>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy && <Spinner label="Signing in" />}
        {busy ? 'Signing in…' : `Sign in to ${portalLabel}`}
      </button>
    </form>
  );
}
