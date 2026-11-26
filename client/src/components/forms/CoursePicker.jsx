import { useMemo, useState } from 'react';
import { creditsLabel, slotLabel } from '../common/format.js';

/**
 * Pick modules from a list grouped by level. When `enforceChoiceGroups` is
 * on (student registration), modules in the same either/or choice group act
 * like radio buttons: picking one un-picks the other. The server enforces the
 * same rule, so this is only a convenience.
 */
export function CoursePicker({ id, modules, selectedIds, onChange, enforceChoiceGroups = false, describedBy }) {
  const [search, setSearch] = useState('');
  const selected = new Set(selectedIds);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? modules.filter((m) => `${m.code} ${m.name}`.toLowerCase().includes(q)) : modules;
  }, [modules, search]);

  const levels = useMemo(() => {
    const byLevel = new Map();
    for (const m of filtered) {
      const list = byLevel.get(m.level) ?? [];
      list.push(m);
      byLevel.set(m.level, list);
    }
    return [...byLevel.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const groupMembers = useMemo(() => {
    const groups = new Map();
    for (const m of modules) {
      if (!m.choiceGroup) continue;
      groups.set(m.choiceGroup, [...(groups.get(m.choiceGroup) ?? []), m]);
    }
    return groups;
  }, [modules]);

  function toggle(module) {
    const next = new Set(selected);
    if (next.has(module.id)) {
      next.delete(module.id);
    } else {
      if (enforceChoiceGroups && module.choiceGroup) {
        for (const other of groupMembers.get(module.choiceGroup) ?? []) next.delete(other.id);
      }
      next.add(module.id);
    }
    onChange([...next]);
  }

  const totalCredits = modules.filter((m) => selected.has(m.id)).reduce((sum, m) => sum + (m.credits ?? 0), 0);

  return (
    <div id={id} aria-describedby={describedBy}>
      <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <input
          type="search"
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Filter by code or name"
          aria-label="Filter modules"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="badge badge-primary" aria-live="polite">
          {selected.size} selected · {totalCredits} credits
        </span>
      </div>

      {levels.length === 0 && <p className="muted">No modules match “{search}”.</p>}

      {levels.map(([level, list]) => (
        <div key={level} className="picker-group" role="group" aria-labelledby={`${id}-level-${level}`}>
          <h4 id={`${id}-level-${level}`}>Level {level}</h4>
          {list.map((m) => {
            const isSelected = selected.has(m.id);
            const partners =
              enforceChoiceGroups && m.choiceGroup
                ? (groupMembers.get(m.choiceGroup) ?? []).filter((o) => o.id !== m.id)
                : [];
            return (
              <label key={m.id} className={`picker-option ${isSelected ? 'selected' : ''}`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(m)} />
                <span style={{ flex: 1 }}>
                  <strong className="mono">{m.code}</strong> {m.name}
                  <span className="meta">
                    <span className="badge">{creditsLabel(m.credits)}</span>
                    <span className="badge">{slotLabel(m.semesterSlot)}</span>
                    {partners.length > 0 && (
                      <span className="badge badge-accent">
                        Either/or with {partners.map((p) => p.code).join(', ')}
                      </span>
                    )}
                    {m.programs && (
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        {m.programs.join(' · ')}
                      </span>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
