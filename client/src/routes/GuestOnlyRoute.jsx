// Login and registration pages for staff: if someone is already signed in,
// send them straight to their own dashboard instead.
import { Navigate, Outlet } from 'react-router';
import { LoadingBlock } from '../components/common/Spinner.jsx';
import { HOME_BY_ROLE } from '../context/contexts.js';
import { useAuth } from '../hooks/useAuth.js';

export function GuestOnlyRoute() {
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingBlock message="Checking your session…" />;
  if (user) return <Navigate to={HOME_BY_ROLE[user.role] ?? '/'} replace />;
  return <Outlet />;
}
