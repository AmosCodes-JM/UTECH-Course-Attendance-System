import { formatDateTime } from '../common/format.js';

/** Attendance records for the selected course and date. */
export function AttendanceTable({ records, timezone }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">Attendance records</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Student ID</th>
            <th scope="col">First name</th>
            <th scope="col">Last name</th>
            <th scope="col">Checked in</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.id}>
              <td className="muted">{i + 1}</td>
              <td className="mono">{r.studentIdNumber}</td>
              <td>{r.firstName}</td>
              <td>{r.lastName}</td>
              <td className="nowrap">{formatDateTime(r.checkedInAt, timezone)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Total attendance</td>
            <td>{records.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
