// Attendance records ("/lecturer/attendance"): filter by course and date,
// then export exactly that view to Excel or PDF.
import { useSearchParams } from 'react-router';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { todayInput } from '../../components/common/format.js';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { AttendanceTable } from '../../components/lecturer/AttendanceTable.jsx';
import { ExportButtons } from '../../components/lecturer/ExportButtons.jsx';
import { FilterBar } from '../../components/lecturer/FilterBar.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { lecturerApi } from '../../services/endpoints.js';

export function AttendancePage() {
  useDocumentTitle('Attendance records');
  const [params, setParams] = useSearchParams();
  const moduleId = params.get('moduleId') ? Number(params.get('moduleId')) : null;
  // The date defaults to today; "all" means no date filter.
  const dateParam = params.get('date');
  const date = dateParam === 'all' ? null : dateParam || todayInput();

  const courses = useApi(() => lecturerApi.courses('all'), []);
  const attendance = useApi(
    () => (moduleId ? lecturerApi.attendance(moduleId, date ?? undefined) : Promise.resolve(null)),
    [moduleId, date],
  );

  function changeFilters(next) {
    const p = {};
    if (next.moduleId) p.moduleId = String(next.moduleId);
    p.date = next.date ?? 'all';
    setParams(p, { replace: true });
  }

  const report = attendance.data;

  return (
    <>
      <PageHeader
        title="Attendance records"
        subtitle="Only courses assigned to you are listed. Exports match the filters you choose."
        actions={<ExportButtons moduleId={moduleId} date={date} disabled={!moduleId || !report} />}
      />

      {courses.error && <ErrorAlert error={courses.error} title="Could not load your courses" />}
      {courses.data && (
        <FilterBar courses={courses.data.courses} moduleId={moduleId} date={date} onChange={changeFilters} />
      )}

      {!moduleId && <EmptyState title="Choose a course">Select one of your courses to see who checked in.</EmptyState>}
      {moduleId && attendance.loading && <LoadingBlock message="Loading attendance…" />}
      {moduleId && attendance.error && <ErrorAlert error={attendance.error} title="Could not load attendance" />}

      {report && !attendance.loading && (
        <section aria-labelledby="report-title">
          <div className="card-header" style={{ marginTop: '0.5rem' }}>
            <h2 id="report-title">
              {report.module.code} – {report.module.name}
            </h2>
            <span className="badge badge-primary">
              {report.date ? `Date: ${report.date}` : 'All dates'} · {report.total} check-in
              {report.total === 1 ? '' : 's'}
            </span>
          </div>
          {report.total === 0 ? (
            <EmptyState title="No check-ins found">
              {report.date
                ? 'Nobody checked in to this course on that date.'
                : 'Nobody has checked in to this course yet.'}
            </EmptyState>
          ) : (
            <AttendanceTable records={report.records} timezone={report.timezone} />
          )}
        </section>
      )}
    </>
  );
}
