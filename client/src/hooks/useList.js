import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

/** Turns filters into a query string, leaving out anything empty. */
export function toQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== undefined && value !== null) query.set(key, value);
  }
  return query.toString();
}

/**
 * Loads one page of a list endpoint. While a new page loads, the previous one stays on
 * screen, and a slow earlier request can never overwrite a newer one.
 */
export function useList(path, params) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const query = toQuery(params);

  useEffect(() => {
    let current = true;
    setState((previous) => ({ ...previous, status: 'loading', error: '' }));

    api
      .get(`${path}?${query}`)
      .then((data) => current && setState({ status: 'ready', data, error: '' }))
      .catch((err) => current && setState({ status: 'error', data: null, error: err.message }));

    return () => {
      current = false;
    };
  }, [path, query, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { ...state, reload };
}
