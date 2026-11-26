// Administrator sign-in ("/admin/login") - administrator accounts only.
// There is deliberately no public administrator registration.
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/common/Alert.jsx';
import { AdminLoginForm } from '../../components/forms/AdminLoginForm.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export function AdminLoginPage() {
  useDocumentTitle('Administrator sign-in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();

  async function handleLogin(identifier, password) {
    const data = await login('admin', identifier, password);
    const from = state?.from?.startsWith('/admin') ? state.from : data.redirectTo;
    navigate(from, { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <span className="badge badge-accent portal-tag">Administrator portal</span>
        <h1>Administrator sign-in</h1>
        <p className="muted">Manage the SCIT catalog, semesters, students and lecturer accounts.</p>
        {state?.expired && (
          <>
            <Alert type="warning" title="Your session has expired">
              Please sign in again to continue.
            </Alert>
            <div style={{ height: '1rem' }} />
          </>
        )}
        <AdminLoginForm onLogin={handleLogin} />
        <p className="muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          Lecturer? <Link to="/lecturer/login">Use the lecturer sign-in</Link>
        </p>
      </div>
    </div>
  );
}
