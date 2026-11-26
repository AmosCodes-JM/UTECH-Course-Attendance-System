// Builds the attendance report as an Excel (.xlsx) workbook with ExcelJS and
// streams it straight into the HTTP response.
import ExcelJS from 'exceljs';
import { config } from '../config/env.js';
import { formatDateTime } from '../utils/dates.js';

export async function writeAttendanceWorkbook(report, lecturerName, stream) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Student Attendance Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attendance', { views: [{ state: 'frozen', ySplit: 8 }] });
  sheet.columns = [
    { key: 'n', width: 6 },
    { key: 'idNumber', width: 16 },
    { key: 'firstName', width: 22 },
    { key: 'lastName', width: 22 },
    { key: 'checkedInAt', width: 26 },
  ];

  sheet.mergeCells('A1:E1');
  sheet.getCell('A1').value = 'Attendance Report';
  sheet.getCell('A1').font = { size: 16, bold: true };

  const meta = [
    ['Course code', report.module.code],
    ['Course name', report.module.name],
    ['Attendance date', report.date ?? 'All dates'],
    ['Lecturer', lecturerName],
    ['Generated', `${formatDateTime(new Date(), config.timezone)} (${config.timezone})`],
  ];
  meta.forEach(([label, value], i) => {
    const row = sheet.getRow(i + 2);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    sheet.mergeCells(i + 2, 2, i + 2, 5);
    row.getCell(2).value = value;
  });

  const header = sheet.getRow(8);
  header.values = ['#', 'Student ID', 'First name', 'Last name', `Check-in time (${config.timezone})`];
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
  });

  report.records.forEach((r, i) => {
    sheet.addRow({
      n: i + 1,
      idNumber: r.studentIdNumber,
      firstName: r.firstName,
      lastName: r.lastName,
      checkedInAt: formatDateTime(new Date(r.checkedInAt), config.timezone),
    });
  });

  const totalRow = sheet.addRow([]);
  totalRow.getCell(1).value = 'Total attendance';
  sheet.mergeCells(totalRow.number, 1, totalRow.number, 4);
  totalRow.getCell(5).value = report.total;
  totalRow.font = { bold: true };

  await workbook.xlsx.write(stream);
}
