import { LoginForm } from './LoginForm.jsx';

/** Administrator-only login: posts to /api/auth/admin/login. */
export function AdminLoginForm({ onLogin }) {
  return <LoginForm portalLabel="administration" onLogin={onLogin} />;
}
