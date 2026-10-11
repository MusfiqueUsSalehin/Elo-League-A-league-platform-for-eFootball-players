import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

const SIGNED_OUT = { status: 'ready', user: null };

/**
 * Holds who is signed in. The session itself is an httpOnly cookie, so nothing secret is
 * kept in the browser: on load we ask the server who we are, and that answer is the truth.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    let active = true;
    api
      .get('/auth/me')
      .then((data) => active && setState({ status: 'ready', user: data.user }))
      .catch(() => active && setState(SIGNED_OUT));
    return () => {
      active = false;
    };
  }, []);

  // Any 401 from anywhere in the app (an expired session, a password reset by an admin)
  // sends the user back to sign-in.
  useEffect(() => {
    setUnauthorizedHandler(() => setState(SIGNED_OUT));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await api.post('/auth/login', { identifier, password });
    setState({ status: 'ready', user: data.user });
    return data.user;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const data = await api.post('/auth/change-password', { currentPassword, newPassword });
    setState({ status: 'ready', user: data.user });
    return data.user;
  }, []);

  // Re-reads the signed-in user, for when their own details were changed elsewhere in the app.
  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setState({ status: 'ready', user: data.user });
    } catch {
      // A 401 already signs the user out; anything else just leaves the old details on screen.
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // The screen must never get stuck signed in. If the request failed, the cookie simply
      // expires on its own; the next page load asks the server again.
    }
    setState(SIGNED_OUT);
  }, []);

  const value = useMemo(
    () => ({
      status: state.status,
      user: state.user,
      isAdmin: state.user?.role === 'admin',
      login,
      logout,
      changePassword,
      refreshUser,
    }),
    [state, login, logout, changePassword, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
