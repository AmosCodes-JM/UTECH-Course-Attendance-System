// One student: edit details and manage per-semester enrollments.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DeleteButton } from '../../components/admin/DeleteButton.jsx';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { creditsLabel } from '../../components/common/format.js';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';

export function StudentDetailPage() {
  const id = Number(useParams().studentId);
  const navigate = useNavigate();
  const notify = useToast();
  const student = useApi(() => adminApi.students.get(id), [id]);
  const programs = useApi(() => adminApi.programs.list(), []);
  const semesters = useApi(() => adminApi.semesters.list(), []);
  const modules = useApi(() => adminApi.modules.list(), []);
  const [editing, setEditing] = useState(false);
  const s = student.data;
  useDocumentTitle(s ? `${s.firstName} ${s.lastName}` : 'Student');

  if (student.loading && !s) return <LoadingBlock />;
  if (student.error) return <ErrorAlert error={student.error} />;

  const detailFields = [
    { name: 'idNumber', label: 'Student ID number', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'firstName', label: 'First name', required: true },
    { name: 'lastName', label: 'Last name', required: true },
    { name: 'programId', label: 'Programme', type: 'select', numeric: true, required: true, options: (programs.data ?? []).map((p) => ({ value: p.id, label: p.displayName })) },
  ];
  const currentSemester = semesters.data?.find((x) => x.isCurrent);
  const enrollFields = [
    { name: 'semesterId', label: 'Semester', type: 'select', numeric: true, required: true, options: (semesters.data ?? []).map((x) => ({ value: x.id, label: `${x.label}${x.isCurrent ? ' (current)' : ''}` })) },
    { name: 'moduleId', label: 'Module', type: 'select', numeric: true, required: true, placeholder: 'Select a module…', options: (modules.data ?? []).map((m) => ({ value: m.id, label: `${m.code} – ${m.name}` })) },
  ];

  // Group enrollments by semester for display.
  const bySemester = new Map();
  for (const e of s.enrollments) {
    const list = bySemester.get(e.semester.id) ?? { semester: e.semester, modules: [] };
    list.modules.push(e.module);
    bySemester.set(e.semester.id, list);
  }

  async function saveDetails(values) {
    await adminApi.students.update(id, values);
    notify.success('Student updated.');
    setEditing(false);
    student.reload();
  }

  async function addEnrollment(values) {
    await adminApi.enrollments.add(id, values);
    notify.success('Enrollment added.');
    student.reload();
  }

  return (
    <>
      <p>
        <Link to="/admin/students">← All students</Link>
      </p>
      <PageHeader
        title={`${s.firstName} ${s.lastName}`}
        subtitle={`ID ${s.idNumber} · ${s.program.displayName} · ${s.attendanceCount} check-in(s)`}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setEditing((v) => !v)}>{editing ? 'Close editor' : 'Edit details'}</button>
            <DeleteButton title="Delete this student?" successMessage="Student deleted." onDelete={() => adminApi.students.remove(id)} onDone={() => navigate('/admin/students')}>
              Their enrollments are removed too. Students with attendance records cannot be deleted.
            </DeleteButton>
          </>
        }
      />
      {editing && programs.data && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>Edit details</h2>
          <SimpleForm fields={detailFields} initialValues={s} onSubmit={saveDetails} onCancel={() => setEditing(false)} />
        </div>
      )}

      <div className="split">
        <section className="card">
          <h2>Enrollments</h2>
          {bySemester.size === 0 && <EmptyState title="No enrollments" />}
          {[...bySemester.values()].map(({ semester, modules: list }) => (
            <div key={semester.id} style={{ marginBottom: '1.25rem' }}>
              <h3>
                {semester.label} {semester.id === currentSemester?.id && <span className="badge badge-open">Current</span>}
              </h3>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {list.map((m) => (
                      <tr key={m.id}>
                        <td className="mono">{m.code}</td>
                        <td>{m.name}</td>
                        <td className="nowrap">{creditsLabel(m.credits)}</td>
                        <td className="actions">
                          <DeleteButton label="Remove" title={`Remove ${m.code} for ${semester.label}?`} successMessage="Enrollment removed." onDelete={() => adminApi.enrollments.remove(id, semester.id, m.id)} onDone={student.reload}>
                            The student will no longer be able to check in to {m.code} sessions in this semester.
                          </DeleteButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
        <aside className="card">
          <h2>Add an enrollment</h2>
          <p className="muted">The either/or rule is checked against the student’s programme.</p>
          {semesters.data && modules.data && (
            <SimpleForm key={s.enrollments.length} fields={enrollFields} columns={1} initialValues={{ semesterId: currentSemester?.id ?? '' }} submitLabel="Add enrollment" onSubmit={addEnrollment} />
          )}
        </aside>
      </div>
    </>
  );
}
