import { initials } from '../common/format.js';

/** Step 2: show who we found so the student can confirm it is them. */
export function StudentConfirmCard({ student, onNotMe }) {
  return (
    <div className="student-card">
      <span className="avatar" aria-hidden="true">
        {initials(student.firstName, student.lastName)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="name">
          {student.firstName} {student.lastName}
        </div>
        <div className="muted">{student.program.displayName}</div>
        <div className="muted mono" style={{ fontSize: '0.9rem' }}>
          ID {student.idNumber}
        </div>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onNotMe}>
        Not you?
      </button>
    </div>
  );
}
