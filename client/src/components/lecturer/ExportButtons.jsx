import { useState } from 'react';
import { Spinner } from '../common/Spinner.jsx';
import { useToast } from '../../hooks/useToast.js';
import { lecturerApi } from '../../services/endpoints.js';

/** Download the current (filtered) view as Excel or PDF, generated on the server. */
export function ExportButtons({ moduleId, date, disabled }) {
  const notify = useToast();
  const [busy, setBusy] = useState(null);

  async function exportAs(format) {
    setBusy(format);
    try {
      await lecturerApi.exportAttendance(format, moduleId, date ?? undefined);
    } catch (error) {
      notify.error(error.message, 'Export failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="btn-row">
      <button type="button" className="btn btn-secondary" onClick={() => exportAs('xlsx')} disabled={disabled || busy !== null}>
        {busy === 'xlsx' ? <Spinner label="Preparing Excel file" /> : '⬇'} Excel (.xlsx)
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => exportAs('pdf')} disabled={disabled || busy !== null}>
        {busy === 'pdf' ? <Spinner label="Preparing PDF" /> : '⬇'} PDF
      </button>
    </div>
  );
}
