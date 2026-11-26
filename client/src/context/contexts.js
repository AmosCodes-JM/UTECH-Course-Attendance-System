// React context objects. The providers live in AuthProvider.jsx and
// ToastProvider.jsx; components read them through the hooks in src/hooks.
import { createContext } from 'react';

export const AuthContext = createContext(null);
export const ToastContext = createContext(null);

/** Where each role's dashboard and login page live. */
export const HOME_BY_ROLE = { LECTURER: '/lecturer', ADMIN: '/admin' };
export const LOGIN_BY_ROLE = { LECTURER: '/lecturer/login', ADMIN: '/admin/login' };
