import { NavLink, Outlet, useNavigate } from 'react-router';
import { Brand } from '../common/Brand.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../../hooks/useToast.js';

const SECTIONS = [
  { title: 'Overview', links: [{ to: '/admin', label: 'Dashboard', end: true }] },
  {
    title: 'Academic catalog',
    links: [
      { to: '/admin/schools', label: 'Schools' },
      { to: '/admin/programs', label: 'Programmes & modules' },
      { to: '/admin/modules', label: 'Modules' },
      { to: '/admin/semesters', label: 'Semesters' },
    ],
  },
  {
    title: 'People',
    links: [
      { to: '/admin/students', label: 'Students & enrollments' },
      { to: '/admin/lecturers', label: 'Lecturers & courses' },
      { to: '/admin/admins', label: 'Administrators' },
    ],
  },
];

export function AdminLayout() {
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
          <Brand to="/admin" subtitle="Administration" />
          <nav className="header-nav" aria-label="Account">
            <span className="header-user">
              {user.firstName} {user.lastName} · Administrator
            </span>
            <button type="button" onClick={handleLogout}>
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Administration">
          {SECTIONS.map((section) => (
            <div key={section.title} style={{ display: 'contents' }}>
              <span className="admin-section-title">{section.title}</span>
              {section.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
