import { useState } from 'react';
import { Link } from 'react-router';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';
import { ACCOUNT_FIELDS } from '../../components/admin/accountFields.js';

export function LecturersPage() {
  useDocumentTitle('Lecturers');
  const notify = useToast();
  const { data, error, loading, reload } = useApi(() => adminApi.lecturers.list(), []);
  const [creating, setCreating] = useState(false);

  async function create(values) {
    await adminApi.lecturers.create(values);
    notify.success('Lecturer account created.');
    setCreating(false);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Lecturers"
        subtitle="Lecturer accounts and their course assignments. Passwords are never shown."
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Add lecturer
          </button>
        }
      />
      {creating && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>New lecturer account</h2>
          <SimpleForm
            fields={ACCOUNT_FIELDS}
            onSubmit={create}
            onCancel={() => setCreating(false)}
            submitLabel="Create account"
          />
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorAlert error={error} />}
      {data && data.length === 0 && <EmptyState title="No lecturers yet" />}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Work ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Courses (current)</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.workId}</td>
                  <td>
                    {l.firstName} {l.lastName}
                  </td>
                  <td>{l.email}</td>
                  <td>{l.currentCourseCount}</td>
                  <td className="actions">
                    <Link className="btn btn-secondary btn-sm" to={`/admin/lecturers/${l.id}`}>
                      Manage
                    </Link>
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
