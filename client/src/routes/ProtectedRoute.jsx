// Route guards (user experience only - the Express API enforces the real rules).
import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingBlock } from '../components/common/Spinner.jsx';
import { HOME_BY_ROLE } from '../context/contexts.js';
import { useAuth } from '../hooks/useAuth.js';

/**
 * Renders the nested routes only for a signed-in user with `role`.
 *  - not signed in        -> that role's login page
 *  - signed in, wrong role -> the user's own dashboard
 */
export function ProtectedRoute({ role, loginPath }) {
  const { status, user, sessionExpired } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingBlock message="Checking your session…" />;

  if (!user) {
    return (
      <Navigate to={loginPath} replace state={{ from: location.pathname + location.search, expired: sessionExpired }} />
    );
  }

  if (user.role !== role) {
    return <Navigate to={HOME_BY_ROLE[user.role] ?? '/'} replace state={{ wrongArea: true }} />;
  }

  return <Outlet />;
}
