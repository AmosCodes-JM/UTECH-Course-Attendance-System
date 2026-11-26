import { useContext } from 'react';
import { AuthContext } from '../context/contexts.js';

/** The signed-in user (or null), plus login/logout helpers. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
