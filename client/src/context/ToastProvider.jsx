// Temporary success / error notifications shown in the corner of the screen.
import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from './contexts.js';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (type, message, title) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, type, message, title }]);
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (message, title) => show('success', message, title),
      error: (message, title) => show('error', message, title),
      info: (message, title) => show('info', message, title),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast alert alert-${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <div style={{ flex: 1 }}>
              {t.title && <span className="alert-title">{t.title}</span>}
              {t.message}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
