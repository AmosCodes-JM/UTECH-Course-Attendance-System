import { Link, useLocation } from 'react-router';
import { Alert, ErrorAlert } from '../../components/common/Alert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { adminApi } from '../../services/endpoints.js';

const STATS = [
  ['programs', 'Programmes', '/admin/programs'],
  ['modules', 'Modules', '/admin/modules'],
  ['students', 'Students', '/admin/students'],
  ['lecturers', 'Lecturers', '/admin/lecturers'],
  ['openSessions', 'Open sessions', null],
  ['attendanceLast24h', 'Check-ins (24 h)', null],
  ['schools', 'Schools', '/admin/schools'],
  ['admins', 'Administrators', '/admin/admins'],
];

export function AdminOverviewPage() {
  useDocumentTitle('Administration');
  const { state } = useLocation();
  const { data, error, loading } = useApi(() => adminApi.overview(), []);

  return (
    <>
      <PageHeader title="Administration" subtitle="Academic catalog, semesters and accounts." />
      {state?.wrongArea && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert type="info">That area is for lecturers, so you were brought to the administration dashboard.</Alert>
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorAlert error={error} />}
      {data && (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            {data.currentSemester ? (
              <Alert type="success" title={`Current semester: ${data.currentSemester.label}`}>
                {data.currentSemester.startDate} to {data.currentSemester.endDate}
              </Alert>
            ) : (
              <Alert
                type="warning"
                title="No active semester today"
                action={
                  <Link to="/admin/semesters" className="btn btn-primary btn-sm">
                    Manage semesters
                  </Link>
                }
              >
                Students cannot register and lecturers cannot open sessions until a semester covers today’s date.
              </Alert>
            )}
          </div>
          <div className="stat-grid">
            {STATS.map(([key, label, to]) => (
              <div key={key} className="stat">
                <div className="value">{data.counts[key]}</div>
                <div className="label">{to ? <Link to={to}>{label}</Link> : label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
