import { vi } from 'vitest';

export const player = {
  _id: 'u1',
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

export const newcomer = { ...player, _id: 'u2', name: 'Arman Hossain', mustChangePassword: true };

export const admin = {
  ...player,
  _id: 'a1',
  name: 'League Admin',
  username: 'admin',
  email: 'admin@eloleague.local',
  role: 'admin',
  platform: 'Mobile',
  elo: 1200,
  peakElo: 1200,
  lastLoginAt: '2026-10-10T12:00:00.000Z',
};

export const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const failure = (status, message, extra = {}) =>
  jsonResponse(status, { success: false, message, ...extra });

const splitUrl = (url) => url.split('?')[0];
const keyOf = (method, url) => `${method ?? 'GET'} ${splitUrl(url)}`;

/**
 * Replaces fetch with a tiny fake server. `routes` maps "METHOD /path" to a function that
 * receives the parsed request body and the full url, and returns a Response (or a promise
 * of one). A route may also be written with its exact query string. An unexpected request
 * fails the test loudly instead of quietly returning nothing.
 */
export function mockApi(routes) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const handler = routes[`${method} ${url}`] ?? routes[keyOf(method, url)];
    if (!handler) throw new Error(`Unexpected request: ${method} ${url}`);
    return handler(options.body ? JSON.parse(options.body) : undefined, url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The requests made so far to one endpoint (query string ignored), as `{ url, body }`. */
export const callsTo = (fetchMock, key) =>
  fetchMock.mock.calls
    .filter(([url, options = {}]) => keyOf(options.method, url) === key)
    .map(([url, options = {}]) => ({
      url,
      body: options.body ? JSON.parse(options.body) : undefined,
    }));
