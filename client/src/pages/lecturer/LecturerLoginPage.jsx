// Lecturer sign-in ("/lecturer/login") - lecturer accounts only.
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/common/Alert.jsx';
import { LecturerLoginForm } from '../../components/forms/LecturerLoginForm.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export function LecturerLoginPage() {
  useDocumentTitle('Lecturer sign-in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();

  async function handleLogin(identifier, password) {
    const data = await login('lecturer', identifier, password);
    const from = state?.from?.startsWith('/lecturer') ? state.from : data.redirectTo;
    navigate(from, { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <span className="badge badge-primary portal-tag">Lecturer portal</span>
        <h1>Lecturer sign-in</h1>
        <p className="muted">Open and close attendance sessions and download attendance reports.</p>
        {state?.expired && (
          <Alert type="warning" title="Your session has expired">
            Please sign in again to continue.
          </Alert>
        )}
        {state?.message && <Alert type="success">{state.message}</Alert>}
        {(state?.expired || state?.message) && <div style={{ height: '1rem' }} />}
        <LecturerLoginForm onLogin={handleLogin} />
        <p className="muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          New lecturer? <Link to="/lecturer/register">Create a lecturer account</Link>
          <br />
          Administrator? <Link to="/admin/login">Use the administrator sign-in</Link>
        </p>
      </div>
    </div>
  );
}
