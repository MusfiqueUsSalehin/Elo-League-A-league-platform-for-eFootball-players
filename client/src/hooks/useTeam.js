import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

/** Loads one team with its squad. Keeps the old data on screen while reloading. */
export function useTeam(teamId) {
  const [state, setState] = useState({ status: 'loading', team: null, squad: [], error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    api
      .get(`/teams/${teamId}`)
      .then(
        (data) =>
          current && setState({ status: 'ready', team: data.team, squad: data.squad, error: null })
      )
      .catch((error) => current && setState({ status: 'error', team: null, squad: [], error }));
    return () => {
      current = false;
    };
  }, [teamId, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { ...state, reload };
}
