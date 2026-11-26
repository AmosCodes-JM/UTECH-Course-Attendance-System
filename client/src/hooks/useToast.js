import { useContext } from 'react';
import { ToastContext } from '../context/contexts.js';

/** Show a temporary success / error notification: notify.success('Saved'). */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
