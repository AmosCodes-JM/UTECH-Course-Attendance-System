// One lecturer: edit the account, reset the password, manage course assignments.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DeleteButton } from '../../components/admin/DeleteButton.jsx';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';

const EDIT_FIELDS = [
  { name: 'firstName', label: 'First name', required: true },
  { name: 'lastName', label: 'Last name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'workId', label: 'Work ID', required: true },
  { name: 'password', label: 'New password (optional)', type: 'password', omitIfEmpty: true, hint: 'Leave blank to keep the current password' },
];

export function LecturerDetailPage() {
  const id = Number(useParams().lecturerId);
  const navigate = useNavigate();
  const notify = useToast();
  const lecturer = useApi(() => adminApi.lecturers.get(id), [id]);
  const semesters = useApi(() => adminApi.semesters.list(), []);
  const modules = useApi(() => adminApi.modules.list(), []);
  const [editing, setEditing] = useState(false);
  const l = lecturer.data;
  useDocumentTitle(l ? `${l.firstName} ${l.lastName}` : 'Lecturer');

  if (lecturer.loading && !l) return <LoadingBlock />;
  if (lecturer.error) return <ErrorAlert error={lecturer.error} />;

  const currentSemester = semesters.data?.find((x) => x.isCurrent);
  const assignFields = [
    { name: 'semesterId', label: 'Semester', type: 'select', numeric: true, required: true, options: (semesters.data ?? []).map((x) => ({ value: x.id, label: `${x.label}${x.isCurrent ? ' (current)' : ''}` })) },
    { name: 'moduleId', label: 'Module', type: 'select', numeric: true, required: true, placeholder: 'Select a module…', options: (modules.data ?? []).map((m) => ({ value: m.id, label: `${m.code} – ${m.name}` })) },
  ];

  async function save(values) {
    await adminApi.lecturers.update(id, values);
    notify.success(values.password ? 'Lecturer updated and password reset.' : 'Lecturer updated.');
    setEditing(false);
    lecturer.reload();
  }

  async function assign(values) {
    await adminApi.assignments.add(id, values);
    notify.success('Course assigned.');
    lecturer.reload();
  }

  return (
    <>
      <p>
        <Link to="/admin/lecturers">← All lecturers</Link>
      </p>
      <PageHeader
        title={`${l.firstName} ${l.lastName}`}
        subtitle={`Work ID ${l.workId} · ${l.email}`}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setEditing((v) => !v)}>{editing ? 'Close editor' : 'Edit account'}</button>
            <DeleteButton title="Delete this lecturer account?" successMessage="Lecturer deleted." onDelete={() => adminApi.lecturers.remove(id)} onDone={() => navigate('/admin/lecturers')}>
              Lecturers who have run class sessions cannot be deleted, to keep attendance history intact.
            </DeleteButton>
          </>
        }
      />
      {editing && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>Edit account</h2>
          <SimpleForm fields={EDIT_FIELDS} initialValues={l} onSubmit={save} onCancel={() => setEditing(false)} />
        </div>
      )}
      <div className="split">
        <section className="card">
          <h2>Course assignments</h2>
          {l.assignments.length === 0 ? (
            <EmptyState title="No courses assigned" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Semester</th>
                    <th>Code</th>
                    <th>Module</th>
                    <th className="actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {l.assignments.map((a) => (
                    <tr key={`${a.semester.id}-${a.module.id}`}>
                      <td className="nowrap">
                        {a.semester.label} {a.semester.id === currentSemester?.id && <span className="badge badge-open">Current</span>}
                      </td>
                      <td className="mono">{a.module.code}</td>
                      <td>{a.module.name}</td>
                      <td className="actions">
                        <DeleteButton label="Unassign" title={`Unassign ${a.module.code}?`} successMessage="Course unassigned." onDelete={() => adminApi.assignments.remove(id, a.semester.id, a.module.id)} onDone={lecturer.reload}>
                          The lecturer will no longer be able to open sessions or view attendance for this course in {a.semester.label}.
                        </DeleteButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="card">
          <h2>Assign a course</h2>
          {semesters.data && modules.data && (
            <SimpleForm key={l.assignments.length} fields={assignFields} columns={1} initialValues={{ semesterId: currentSemester?.id ?? '' }} submitLabel="Assign course" onSubmit={assign} />
          )}
        </aside>
      </div>
    </>
  );
}
