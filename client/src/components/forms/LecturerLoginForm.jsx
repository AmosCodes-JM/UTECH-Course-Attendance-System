import { LoginForm } from './LoginForm.jsx';

/** Lecturer-only login: posts to /api/auth/lecturer/login. */
export function LecturerLoginForm({ onLogin }) {
  return <LoginForm portalLabel="the lecturer area" onLogin={onLogin} />;
}
