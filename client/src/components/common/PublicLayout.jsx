import { NavLink, Outlet } from 'react-router';
import { Brand } from './Brand.jsx';

/** Header + footer around the public pages (kiosk, registration, logins). */
export function PublicLayout() {
  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Brand subtitle="Student check-in" />
          <nav className="header-nav" aria-label="Main">
            <NavLink to="/" end>
              Check in
            </NavLink>
            <NavLink to="/register">Register</NavLink>
            <NavLink to="/lecturer/login">Lecturers</NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="app-footer">
        School of Computing &amp; Information Technology · <NavLink to="/admin/login">Administrator sign-in</NavLink>
      </footer>
    </>
  );
}
