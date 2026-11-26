// Administrator accounts. Only a signed-in administrator can create another
// one; there is no public administrator registration.
import { useState } from 'react';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { Alert, ErrorAlert } from '../../components/common/Alert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';
import { ACCOUNT_FIELDS } from '../../components/admin/accountFields.js';

export function AdminsPage() {
  useDocumentTitle('Administrators');
  const notify = useToast();
  const { data, error, loading, reload } = useApi(() => adminApi.admins.list(), []);
  const [creating, setCreating] = useState(false);

  async function create(values) {
    await adminApi.admins.create(values);
    notify.success('Administrator account created.');
    setCreating(false);
    reload();
  }

  return (
    <>
      <PageHeader title="Administrators" actions={<button className="btn btn-primary" onClick={() => setCreating(true)}>Add administrator</button>} />
      <div style={{ marginBottom: '1.25rem' }}>
        <Alert type="warning" title="Administrators have full access">
          Only create administrator accounts for people who manage the catalog and user accounts.
        </Alert>
      </div>
      {creating && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>New administrator</h2>
          <SimpleForm fields={ACCOUNT_FIELDS} onSubmit={create} onCancel={() => setCreating(false)} submitLabel="Create administrator" />
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorAlert error={error} />}
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Work ID</th>
                <th>Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.workId}</td>
                  <td>{a.firstName} {a.lastName}</td>
                  <td>{a.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
