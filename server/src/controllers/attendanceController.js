// Student check-in (public) and lecturer attendance viewing / exports.
import { checkIn, listAttendance } from '../services/attendanceService.js';
import { writeAttendanceWorkbook } from '../exports/excelReport.js';
import { writeAttendancePdf } from '../exports/pdfReport.js';

/** POST /api/attendance - the body only ever contains idNumber + sessionId. */
export async function recordAttendance(req, res) {
  const result = await checkIn(req.validated.body);
  res.status(201).json({ success: true, data: result });
}

/** GET /api/attendance?moduleId=&date= (lecturer, ownership already checked) */
export async function viewAttendance(req, res) {
  const { moduleId, date } = req.validated.query;
  const report = await listAttendance({ lecturerId: req.user.id, moduleId, date });
  res.json({ success: true, data: report });
}

/** GET /api/attendance/export?format=xlsx|pdf&moduleId=&date= */
export async function exportAttendance(req, res) {
  const { moduleId, date, format } = req.validated.query;
  const report = await listAttendance({ lecturerId: req.user.id, moduleId, date });
  const lecturer = `${req.user.firstName} ${req.user.lastName}`;
  const fileBase = `attendance-${report.module.code}-${date ?? 'all-dates'}`;

  if (format === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.xlsx"`);
    await writeAttendanceWorkbook(report, lecturer, res);
    return res.end();
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.pdf"`);
  await writeAttendancePdf(report, lecturer, res);
}
