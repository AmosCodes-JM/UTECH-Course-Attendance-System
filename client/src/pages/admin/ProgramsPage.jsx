import { useState } from 'react';
import { Link } from 'react-router';
import { DeleteButton } from '../../components/admin/DeleteButton.jsx';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';

export function ProgramsPage() {
  useDocumentTitle('Programmes');
  const notify = useToast();
  const programs = useApi(() => adminApi.programs.list(), []);
  const schools = useApi(() => adminApi.schools.list(), []);
  const [editing, setEditing] = useState(null);

  const fields = [
    {
      name: 'schoolId',
      label: 'School',
      type: 'select',
      numeric: true,
      required: true,
      placeholder: 'Select a school…',
      options: (schools.data ?? []).map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` })),
    },
    { name: 'name', label: 'Programme name', required: true, placeholder: 'BSc Computing' },
    { name: 'major', label: 'Major (optional)', placeholder: 'Computer Science' },
  ];

  async function save(values) {
    if (editing === 'new') await adminApi.programs.create(values);
    else await adminApi.programs.update(editing.id, values);
    notify.success('Programme saved.');
    setEditing(null);
    programs.reload();
  }

  return (
    <>
      <PageHeader
        title="Programmes"
        subtitle="Programmes and the modules they offer (from the SCIT diet sheets)."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={!schools.data}>
            Add programme
          </button>
        }
      />
      {editing && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>{editing === 'new' ? 'New programme' : `Edit ${editing.displayName}`}</h2>
          <SimpleForm
            key={editing.id ?? 'new'}
            fields={fields}
            columns={3}
            initialValues={editing === 'new' ? {} : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
      {programs.loading && <LoadingBlock />}
      {programs.error && <ErrorAlert error={programs.error} />}
      {programs.data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Programme</th>
                <th>Major</th>
                <th>School</th>
                <th>Modules</th>
                <th>Students</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {programs.data.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.major ?? <span className="muted">—</span>}</td>
                  <td className="mono">{p.school.code}</td>
                  <td>{p.moduleCount}</td>
                  <td>{p.studentCount}</td>
                  <td className="actions">
                    <Link className="btn btn-secondary btn-sm" to={`/admin/programs/${p.id}`}>
                      Modules
                    </Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <DeleteButton
                      title={`Delete ${p.displayName}?`}
                      onDelete={() => adminApi.programs.remove(p.id)}
                      onDone={programs.reload}
                    >
                      Its module assignments are removed too (the modules themselves stay). Programmes with registered
                      students cannot be deleted.
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
