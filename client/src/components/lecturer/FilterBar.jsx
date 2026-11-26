/** Course and date filters for the attendance page. */
export function FilterBar({ courses, moduleId, date, onChange }) {
  return (
    <div className="card filter-bar">
      <div className="field">
        <label htmlFor="filter-course">Course</label>
        <select
          id="filter-course"
          className="select"
          value={moduleId ?? ''}
          onChange={(e) => onChange({ moduleId: e.target.value ? Number(e.target.value) : null, date })}
        >
          <option value="">Select a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} – {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="filter-date">Date</label>
        <input
          id="filter-date"
          type="date"
          className="input"
          value={date ?? ''}
          onChange={(e) => onChange({ moduleId, date: e.target.value || null })}
        />
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => onChange({ moduleId, date: null })} disabled={!date}>
        All dates
      </button>
    </div>
  );
}
