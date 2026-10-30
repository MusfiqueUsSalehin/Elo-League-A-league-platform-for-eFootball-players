import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

/** Loads one competition and the entries you are allowed to see. */
export function useTournament(id) {
  const [state, setState] = useState({
    status: 'loading',
    tournament: null,
    entries: [],
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    Promise.all([api.get(`/tournaments/${id}`), api.get(`/tournaments/${id}/entries`)])
      .then(
        ([tournament, entries]) =>
          current &&
          setState({
            status: 'ready',
            tournament: tournament.tournament,
            entries: entries.items,
            error: null,
          })
      )
      .catch(
        (error) => current && setState({ status: 'error', tournament: null, entries: [], error })
      );
    return () => {
      current = false;
    };
  }, [id, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { ...state, reload };
}
