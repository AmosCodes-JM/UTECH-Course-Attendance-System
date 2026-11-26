/**
 * Choose a programme of study. Single mode (students) renders a <select>
 * grouped by degree; multiple mode (lecturers) renders toggleable chips.
 */
function groupByName(programs) {
  const groups = new Map();
  for (const p of programs) {
    const list = groups.get(p.name) ?? [];
    list.push(p);
    groups.set(p.name, list);
  }
  return [...groups.entries()];
}

export function ProgramPicker({ id, programs, multiple = false, value, onChange, invalid, describedBy }) {
  if (!multiple) {
    return (
      <select
        id={id}
        className="select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
      >
        <option value="">Select your programme…</option>
        {groupByName(programs).map(([name, list]) => (
          <optgroup key={name} label={name}>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.major ?? name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  const selected = new Set(value ?? []);
  const toggle = (programId) => {
    const next = new Set(selected);
    if (next.has(programId)) next.delete(programId);
    else next.add(programId);
    onChange([...next]);
  };

  return (
    <div id={id} role="group" aria-describedby={describedBy} style={{ display: 'grid', gap: '0.75rem' }}>
      {groupByName(programs).map(([name, list]) => (
        <div key={name}>
          <div className="muted" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
            {name}
          </div>
          <div className="chip-list">
            {list.map((p) => (
              <label key={p.id} className={`chip ${selected.has(p.id) ? 'selected' : ''}`}>
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                {p.major ?? 'General'}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
