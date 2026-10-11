import { vi } from 'vitest';

export const player = {
  id: 'u1',
  name: 'Rahim Uddin',
  username: 'rahim',
  email: 'rahim@example.com',
  role: 'user',
  platform: 'PS5',
  elo: 1200,
  peakElo: 1250,
  mustChangePassword: false,
  isActive: true,
};

export const newcomer = { ...player, id: 'u2', name: 'Arman Hossain', mustChangePassword: true };

export const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const failure = (status, message, extra = {}) =>
  jsonResponse(status, { success: false, message, ...extra });

/**
 * Replaces fetch with a tiny fake server. `routes` maps "METHOD /path" to a function that
 * receives the parsed request body and returns a Response. An unexpected request fails the
 * test loudly instead of quietly returning nothing.
 */
export function mockApi(routes) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return handler(options.body ? JSON.parse(options.body) : undefined);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The requests made so far to one endpoint, as `{ body }` objects. */
export const callsTo = (fetchMock, key) =>
  fetchMock.mock.calls
    .filter(([url, options = {}]) => `${options.method ?? 'GET'} ${url}` === key)
    .map(([, options]) => ({ body: options.body ? JSON.parse(options.body) : undefined }));
