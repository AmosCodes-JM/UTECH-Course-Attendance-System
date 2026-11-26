import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · SCIT Attendance` : 'SCIT Attendance';
  }, [title]);
}
