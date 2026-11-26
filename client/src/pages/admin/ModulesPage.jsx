import { useState } from 'react';
import { DeleteButton } from '../../components/admin/DeleteButton.jsx';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { creditsLabel } from '../../components/common/format.js';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';

const FIELDS = [
  { name: 'code', label: 'Module code', required: true, placeholder: 'CIT2004' },
  { name: 'name', label: 'Module name', required: true },
  { name: 'credits', label: 'Credits', type: 'number', hint: 'Leave blank if the diet sheet does not say.' },
];

export function ModulesPage() {
  useDocumentTitle('Modules');
  const notify = useToast();
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useApi(() => adminApi.modules.list(), []);
  const [editing, setEditing] = useState(null);

  async function save(values) {
    if (editing === 'new') await adminApi.modules.create(values);
    else await adminApi.modules.update(editing.id, values);
    notify.success('Module saved.');
    setEditing(null);
    reload();
  }

  const q = search.trim().toLowerCase();
  const visible = (data ?? []).filter((m) => !q || `${m.code} ${m.name}`.toLowerCase().includes(q));

  return (
    <>
      <PageHeader
        title="Modules"
        subtitle={data ? `${data.length} modules in the catalog. Each module is stored once, even when several programmes share it.` : 'Module catalog'}
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}>Add module</button>}
      />
      {editing && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>{editing === 'new' ? 'New module' : `Edit ${editing.code}`}</h2>
          <SimpleForm key={editing.id ?? 'new'} fields={FIELDS} columns={3} initialValues={editing === 'new' ? {} : editing} onSubmit={save} onCancel={() => setEditing(null)} />
        </div>
      )}
      <input className="input" style={{ maxWidth: 360, marginBottom: '0.75rem' }} type="search" placeholder="Search by code or name" aria-label="Search modules" value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading && <LoadingBlock />}
      {error && <ErrorAlert error={error} />}
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Credits</th>
                <th>Programmes</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.code}</td>
                  <td>{m.name}</td>
                  <td className="nowrap">{creditsLabel(m.credits)}</td>
                  <td title={m.programs.map((p) => p.displayName).join('\n')}>
                    {m.programs.length === 0 ? <span className="muted">None</span> : `${m.programs.length} programme${m.programs.length === 1 ? '' : 's'}`}
                  </td>
                  <td className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(m)}>Edit</button>
                    <DeleteButton title={`Delete ${m.code}?`} onDelete={() => adminApi.modules.remove(m.id)} onDone={reload}>
                      Modules with enrollments, lecturer assignments or class sessions cannot be deleted.
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
