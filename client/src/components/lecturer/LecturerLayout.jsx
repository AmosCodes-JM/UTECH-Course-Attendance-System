import { NavLink, Outlet, useNavigate } from 'react-router';
import { Brand } from '../common/Brand.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';

export function LecturerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();

  async function handleLogout() {
    try {
      const to = await logout();
      notify.info('You have been signed out.');
      navigate(to, { replace: true });
    } catch (error) {
      notify.error(error.message, 'Sign-out failed');
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Brand to="/lecturer" subtitle="Lecturer area" />
          <nav className="header-nav" aria-label="Lecturer">
            <NavLink to="/lecturer" end>
              My courses
            </NavLink>
            <NavLink to="/lecturer/attendance">Attendance</NavLink>
            <span className="header-user">
              {user.firstName} {user.lastName}
            </span>
            <button type="button" onClick={handleLogout}>
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
