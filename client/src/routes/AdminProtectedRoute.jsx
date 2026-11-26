import { ProtectedRoute } from './ProtectedRoute.jsx';

export function AdminProtectedRoute() {
  return <ProtectedRoute role="ADMIN" loginPath="/admin/login" />;
}
