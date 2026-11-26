import { ProtectedRoute } from './ProtectedRoute.jsx';

export function LecturerProtectedRoute() {
  return <ProtectedRoute role="LECTURER" loginPath="/lecturer/login" />;
}
