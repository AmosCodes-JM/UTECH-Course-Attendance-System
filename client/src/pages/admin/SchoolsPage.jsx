import { useState } from 'react';
import { DeleteButton } from '../../components/admin/DeleteButton.jsx';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';

const FIELDS = [
  { name: 'code', label: 'School code', required: true, placeholder: 'SCIT' },
  { name: 'name', label: 'School name', required: true },
];

export function SchoolsPage() {
  useDocumentTitle('Schools');
  const notify = useToast();
  const { data, error, loading, reload } = useApi(() => adminApi.schools.list(), []);
  const [editing, setEditing] = useState(null); // null | 'new' | school

  async function save(values) {
    if (editing === 'new') await adminApi.schools.create(values);
    else await adminApi.schools.update(editing.id, values);
    notify.success('School saved.');
    setEditing(null);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Schools"
        subtitle="Top level of the academic catalog."
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}>Add school</button>}
      />
      {editing && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>{editing === 'new' ? 'New school' : `Edit ${editing.code}`}</h2>
          <SimpleForm key={editing.id ?? 'new'} fields={FIELDS} initialValues={editing === 'new' ? {} : editing} onSubmit={save} onCancel={() => setEditing(null)} />
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorAlert error={error} />}
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Programmes</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.code}</td>
                  <td>{s.name}</td>
                  <td>{s.programCount}</td>
                  <td className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>Edit</button>
                    <DeleteButton title={`Delete ${s.code}?`} onDelete={() => adminApi.schools.remove(s.id)} onDone={reload}>
                      A school can only be deleted when it has no programmes.
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
