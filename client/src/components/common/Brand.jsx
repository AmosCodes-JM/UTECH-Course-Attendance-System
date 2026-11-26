import { Link } from 'react-router';

export function Brand({ to = '/', subtitle = 'Attendance' }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark" aria-hidden="true">
        SA
      </span>
      <span>
        SCIT Attendance
        <small>{subtitle}</small>
      </span>
    </Link>
  );
}
