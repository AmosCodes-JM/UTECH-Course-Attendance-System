import { formatTime } from '../common/format.js';
import { Spinner } from '../common/Spinner.jsx';

/** Step 3: one large button per enrolled course that has an open session. */
export function CourseButtonList({ courses, busySessionId, onSelect }) {
  const busy = busySessionId !== null;
  return (
    <div className="course-buttons" role="list">
      {courses.map((course) => (
        <div role="listitem" key={course.sessionId}>
          <button
            type="button"
            className="course-button"
            disabled={busy || course.alreadyCheckedIn}
            onClick={() => onSelect(course)}
            aria-describedby={`course-${course.sessionId}-status`}
          >
            <span className="code">{course.code}</span>
            <span className="title">{course.name}</span>
            <span className="sub" id={`course-${course.sessionId}-status`}>
              {busySessionId === course.sessionId ? (
                <>
                  <Spinner label="Recording attendance" /> Recording your attendance…
                </>
              ) : course.alreadyCheckedIn ? (
                `✓ Already checked in at ${formatTime(course.checkedInAt)}`
              ) : (
                `${course.lecturer} · session opened ${formatTime(course.openedAt)}`
              )}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
