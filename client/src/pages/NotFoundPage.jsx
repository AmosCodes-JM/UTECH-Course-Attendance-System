import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="page page-narrow">
      <div className="empty">
        <h3>Page not found</h3>
        <p>The page you were looking for does not exist.</p>
        <Link className="btn btn-primary" to="/">
          Go to check-in
        </Link>
      </div>
    </div>
  );
}
