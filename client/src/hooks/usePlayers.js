import { useList } from './useList.js';

export { toQuery } from './useList.js';

/** One page of league players (accounts), for the admin screen. */
export const usePlayers = (params) => useList('/users', params);
