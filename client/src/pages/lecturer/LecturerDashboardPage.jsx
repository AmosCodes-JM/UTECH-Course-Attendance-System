// Lecturer dashboard ("/lecturer"): the lecturer's current-semester courses
// with session status and open / close buttons.
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { Alert, ErrorAlert } from '../../components/common/Alert.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { creditsLabel, formatTime } from '../../components/common/format.js';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { SessionToggle } from '../../components/lecturer/SessionToggle.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { lecturerApi } from '../../services/endpoints.js';

const LIVE_REFRESH_MS = 15_000;

export function LecturerDashboardPage() {
  useDocumentTitle('My courses');
  const { user } = useAuth();
  const { state } = useLocation();
  const { data, error, loading, reload } = useApi(() => lecturerApi.courses('current'), []);
  const anyOpen = data?.courses.some((c) => c.openSession);

  // While a session is open, refresh the live check-in counts.
  useEffect(() => {
    if (!anyOpen) return undefined;
    const timer = setInterval(reload, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [anyOpen, reload]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.firstName}`}
        subtitle={data?.semester ? `Your courses for ${data.semester.label}` : 'Your courses'}
        actions={
          <Link to="/lecturer/attendance" className="btn btn-secondary">
            View attendance records
          </Link>
        }
      />

      {state?.wrongArea && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert type="info">That area is not available to lecturers, so you were brought to your dashboard.</Alert>
        </div>
      )}
      {loading && !data && <LoadingBlock message="Loading your courses…" />}
      {error && <ErrorAlert error={error} title="Could not load your courses" />}

      {data && !data.semester && (
        <EmptyState title="No active semester">
          There is no semester running today, so there are no courses to show. Contact an administrator if this is
          wrong.
        </EmptyState>
      )}

      {data?.semester && data.courses.length === 0 && (
        <EmptyState title="No courses assigned">
          You have no courses assigned for {data.semester.label}. Ask an administrator to assign your courses.
        </EmptyState>
      )}

      {data?.courses.length > 0 && (
        <div className="course-grid">
          {data.courses.map((course) => (
            <article key={course.id} className={`course-card ${course.openSession ? 'is-open' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'start' }}>
                <span className="course-code">{course.code}</span>
                {course.openSession ? (
                  <span className="badge badge-open">Open since {formatTime(course.openSession.openedAt)}</span>
                ) : (
                  <span className="badge">No open session</span>
                )}
              </div>
              <h3>{course.name}</h3>
              <div className="muted" style={{ fontSize: '0.9rem' }}>
                {creditsLabel(course.credits)} · {course.programs.join(' · ')}
              </div>
              {course.openSession && (
                <div aria-live="polite">
                  <span className="live-count">{course.openSession.attendanceCount}</span>{' '}
                  <span className="muted">student{course.openSession.attendanceCount === 1 ? '' : 's'} checked in</span>
                </div>
              )}
              <div className="footer">
                <SessionToggle course={course} onChanged={reload} />
                <Link to={`/lecturer/attendance?moduleId=${course.id}`} className="btn btn-ghost btn-sm">
                  Attendance →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
