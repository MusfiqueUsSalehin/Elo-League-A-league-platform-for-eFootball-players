import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/** Loads matches for a query like { tournament: id, limit: '500' }, ignoring stale answers. */
export function useMatches(query) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null });
  const qs = new URLSearchParams(query).toString();

  useEffect(() => {
    let current = true;
    api
      .get(`/matches?${qs}`)
      .then((res) => current && setState({ status: 'ready', items: res.items, error: null }))
      .catch((error) => current && setState({ status: 'error', items: [], error }));
    return () => {
      current = false;
    };
  }, [qs]);

  return state;
}
