import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const UnreadContext = createContext({ count: 0, refresh: () => {} });

const POLL_MS = 60_000;

/** Keeps the number of unread notifications fresh for the badge in the navigation. */
export function UnreadProvider({ children }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/notifications/unread-count');
      setCount(data.count);
    } catch {
      // The badge simply keeps its last value; a 401 already signs the user out elsewhere.
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);
