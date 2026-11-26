// Keeps track of the signed-in lecturer or administrator.
//
// This is for the user interface only (what to show, where to redirect).
// Real protection happens on the server: every protected API call is checked
// against the server-side session, whatever this context believes.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { onUnauthorized, setCsrfToken } from '../services/api.js';
import { authApi } from '../services/endpoints.js';
import { AuthContext, LOGIN_BY_ROLE } from './contexts.js';

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, sessionExpired: false });

  const applySession = useCallback((data) => {
    setCsrfToken(data?.csrfToken ?? null);
    setState({ status: 'ready', user: data?.user ?? null, sessionExpired: false });
  }, []);

  // On first load, ask the server whether a session already exists.
  useEffect(() => {
    authApi
      .session()
      .then(applySession)
      .catch(() => setState({ status: 'ready', user: null, sessionExpired: false }));
  }, [applySession]);

  // A protected request came back 401: the server-side session is gone.
  useEffect(() => {
    onUnauthorized(() => {
      setCsrfToken(null);
      setState((s) => (s.user ? { status: 'ready', user: null, sessionExpired: true } : s));
    });
    return () => onUnauthorized(null);
  }, []);

  const login = useCallback(
    async (portal, identifier, password) => {
      const data =
        portal === 'admin'
          ? await authApi.adminLogin(identifier, password)
          : await authApi.lecturerLogin(identifier, password);
      applySession(data);
      return data;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const role = state.user?.role;
    try {
      if (role === 'ADMIN') await authApi.adminLogout();
      else if (role === 'LECTURER') await authApi.lecturerLogout();
    } finally {
      setCsrfToken(null);
      setState({ status: 'ready', user: null, sessionExpired: false });
    }
    return LOGIN_BY_ROLE[role] ?? '/';
  }, [state.user]);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
