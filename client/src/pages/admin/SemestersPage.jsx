import { useState } from 'react';
import { DeleteButton } from '../../components/admin/DeleteButton.jsx';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { Alert, ErrorAlert } from '../../components/common/Alert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';

const FIELDS = [
  { name: 'academicYear', label: 'Academic year', required: true, placeholder: '2026/2027' },
  {
    name: 'term',
    label: 'Term',
    type: 'select',
    numeric: true,
    required: true,
    options: [
      { value: 1, label: 'Semester 1' },
      { value: 2, label: 'Semester 2' },
    ],
  },
  { name: 'startDate', label: 'Start date', type: 'date', required: true },
  { name: 'endDate', label: 'End date', type: 'date', required: true },
];

export function SemestersPage() {
  useDocumentTitle('Semesters');
  const notify = useToast();
  const { data, error, loading, reload } = useApi(() => adminApi.semesters.list(), []);
  const [editing, setEditing] = useState(null);

  async function save(values) {
    if (editing === 'new') await adminApi.semesters.create(values);
    else await adminApi.semesters.update(editing.id, values);
    notify.success('Semester saved.');
    setEditing(null);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Semesters"
        subtitle="The current semester is the one whose dates include today."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            Add semester
          </button>
        }
      />
      <div style={{ marginBottom: '1.25rem' }}>
        <Alert type="info">
          Standard calendar: Semester 1 runs September–December and Semester 2 January–May. Year-long modules are
          available in both. Date ranges may not overlap.
        </Alert>
      </div>
      {editing && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>{editing === 'new' ? 'New semester' : `Edit ${editing.label}`}</h2>
          <SimpleForm
            key={editing.id ?? 'new'}
            fields={FIELDS}
            initialValues={editing === 'new' ? {} : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorAlert error={error} />}
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Semester</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Status</th>
                <th>Usage</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td className="nowrap">{s.startDate}</td>
                  <td className="nowrap">{s.endDate}</td>
                  <td>
                    {s.isCurrent ? <span className="badge badge-open">Current</span> : <span className="muted">—</span>}
                  </td>
                  <td className="muted" style={{ fontSize: '0.85rem' }}>
                    {s.usage.enrollments} enrollments · {s.usage.lecturerModules} assignments · {s.usage.classSessions}{' '}
                    sessions
                  </td>
                  <td className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>
                      Edit
                    </button>
                    <DeleteButton
                      title={`Delete ${s.label}?`}
                      onDelete={() => adminApi.semesters.remove(s.id)}
                      onDone={reload}
                    >
                      Semesters that already have enrollments, assignments or sessions cannot be deleted.
                    </DeleteButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
