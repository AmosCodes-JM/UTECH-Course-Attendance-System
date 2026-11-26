// Manage one programme's modules: level, semester slot and either/or choice group.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { DeleteButton } from '../../components/admin/DeleteButton.jsx';
import { SimpleForm } from '../../components/admin/SimpleForm.jsx';
import { ErrorAlert } from '../../components/common/Alert.jsx';
import { creditsLabel, slotLabel } from '../../components/common/format.js';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { LoadingBlock } from '../../components/common/Spinner.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useToast } from '../../hooks/useToast.js';
import { adminApi } from '../../services/endpoints.js';

const SLOT_OPTIONS = ['1', '2', 'YEAR', 'EITHER'].map((s) => ({ value: s, label: slotLabel(s) }));
const LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6].map((l) => ({ value: l, label: `Level ${l}` }));

export function ProgramModulesPage() {
  const programId = Number(useParams().programId);
  const notify = useToast();
  const programs = useApi(() => adminApi.programs.list(), []);
  const rows = useApi(() => adminApi.programModules.list(programId), [programId]);
  const modules = useApi(() => adminApi.modules.list(), []);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [filter, setFilter] = useState('');

  const program = programs.data?.find((p) => p.id === programId);
  useDocumentTitle(program ? `${program.displayName} modules` : 'Programme modules');

  const assigned = new Set((rows.data ?? []).map((r) => r.moduleId));
  const detailFields = [
    { name: 'level', label: 'Level', type: 'select', numeric: true, required: true, options: LEVEL_OPTIONS },
    { name: 'semesterSlot', label: 'Semester slot', type: 'select', required: true, options: SLOT_OPTIONS },
    {
      name: 'choiceGroup',
      label: 'Either/or group (optional)',
      placeholder: 'e.g. ENS3001/MEE2003',
      hint: 'Modules sharing a group are alternatives.',
    },
  ];
  const newFields = [
    {
      name: 'moduleId',
      label: 'Module',
      type: 'select',
      numeric: true,
      required: true,
      placeholder: 'Select a module…',
      options: (modules.data ?? [])
        .filter((m) => !assigned.has(m.id))
        .map((m) => ({ value: m.id, label: `${m.code} – ${m.name}` })),
    },
    ...detailFields,
  ];

  async function save(values) {
    if (editing === 'new') await adminApi.programModules.add(programId, values);
    else await adminApi.programModules.update(programId, editing.moduleId, values);
    notify.success('Programme module saved.');
    setEditing(null);
    rows.reload();
  }

  const q = filter.trim().toLowerCase();
  const visible = (rows.data ?? []).filter((r) => !q || `${r.module.code} ${r.module.name}`.toLowerCase().includes(q));

  return (
    <>
      <p>
        <Link to="/admin/programs">← All programmes</Link>
      </p>
      <PageHeader
        title={program?.displayName ?? 'Programme modules'}
        subtitle="Level, semester slot and either/or group for each module. A module can belong to several programmes."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={!modules.data}>
            Add module to programme
          </button>
        }
      />
      {editing && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2>{editing === 'new' ? 'Add a module' : `Edit ${editing.module.code}`}</h2>
          <SimpleForm
            key={editing.moduleId ?? 'new'}
            fields={editing === 'new' ? newFields : detailFields}
            columns={editing === 'new' ? 2 : 3}
            initialValues={editing === 'new' ? {} : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
      {rows.loading && <LoadingBlock />}
      {rows.error && <ErrorAlert error={rows.error} />}
      {rows.data && (
        <>
          <input
            className="input"
            style={{ maxWidth: 320, marginBottom: '0.75rem' }}
            type="search"
            placeholder="Filter modules"
            aria-label="Filter modules"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Module</th>
                  <th>Credits</th>
                  <th>Level</th>
                  <th>Semester</th>
                  <th>Either/or group</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.moduleId}>
                    <td className="mono">{r.module.code}</td>
                    <td>{r.module.name}</td>
                    <td>{creditsLabel(r.module.credits)}</td>
                    <td>{r.level}</td>
                    <td>
                      <span className={`badge ${r.semesterSlot === 'YEAR' ? 'badge-primary' : ''}`}>
                        {slotLabel(r.semesterSlot)}
                      </span>
                    </td>
                    <td>
                      {r.choiceGroup ? (
                        <span className="badge badge-accent">{r.choiceGroup}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(r)}>
                        Edit
                      </button>
                      <DeleteButton
                        label="Remove"
                        title={`Remove ${r.module.code} from this programme?`}
                        successMessage="Module removed from programme."
                        onDelete={() => adminApi.programModules.remove(programId, r.moduleId)}
                        onDone={rows.reload}
                      >
                        The module stays in the catalog and in other programmes.
                      </DeleteButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
