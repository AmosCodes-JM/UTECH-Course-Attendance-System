// Builds the attendance report as a PDF with PDFKit and streams it into the
// HTTP response. Rows flow onto new pages automatically, repeating the header.
import PDFDocument from 'pdfkit';
import { config } from '../config/env.js';
import { formatDateTime } from '../utils/dates.js';

const COLUMNS = [
  { title: '#', width: 30 },
  { title: 'Student ID', width: 90 },
  { title: 'First name', width: 120 },
  { title: 'Last name', width: 120 },
  { title: 'Check-in time', width: 139 },
];
const ROW_HEIGHT = 20;

function drawTableHeader(doc, y) {
  const left = doc.page.margins.left;
  const width = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  doc.rect(left, y, width, ROW_HEIGHT).fill('#1f3a5f');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
  let x = left;
  for (const col of COLUMNS) {
    doc.text(col.title, x + 5, y + 6, { width: col.width - 10, lineBreak: false });
    x += col.width;
  }
  doc.fillColor('#000000').font('Helvetica');
  return y + ROW_HEIGHT;
}

export function writeAttendancePdf(report, lecturerName, stream) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Attendance ${report.module.code}` } });
    doc.on('error', reject);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);

    doc.font('Helvetica-Bold').fontSize(18).text('Attendance Report');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11);
    const meta = [
      ['Course', `${report.module.code} – ${report.module.name}`],
      ['Attendance date', report.date ?? 'All dates'],
      ['Lecturer', lecturerName],
      ['Generated', `${formatDateTime(new Date(), config.timezone)} (${config.timezone})`],
      ['Total attendance', String(report.total)],
    ];
    for (const [label, value] of meta) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value);
    }
    doc.moveDown();

    const bottom = () => doc.page.height - doc.page.margins.bottom;
    let y = drawTableHeader(doc, doc.y);

    if (report.records.length === 0) {
      doc.fontSize(10).text('No attendance records match the selected filters.', doc.page.margins.left + 5, y + 6);
      y += ROW_HEIGHT;
    }

    report.records.forEach((r, i) => {
      if (y + ROW_HEIGHT > bottom()) {
        doc.addPage();
        y = drawTableHeader(doc, doc.page.margins.top);
      }
      if (i % 2 === 1) {
        doc.rect(doc.page.margins.left, y, 499, ROW_HEIGHT).fill('#eef2f7').fillColor('#000000');
      }
      const cells = [
        String(i + 1),
        r.studentIdNumber,
        r.firstName,
        r.lastName,
        formatDateTime(new Date(r.checkedInAt), config.timezone),
      ];
      let x = doc.page.margins.left;
      doc.fontSize(10);
      cells.forEach((value, c) => {
        doc.text(value, x + 5, y + 6, { width: COLUMNS[c].width - 10, lineBreak: false, ellipsis: true });
        x += COLUMNS[c].width;
      });
      y += ROW_HEIGHT;
    });

    if (y + 30 > bottom()) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(`Total attendance: ${report.total}`, doc.page.margins.left, y + 12);
    doc.end();
  });
}
