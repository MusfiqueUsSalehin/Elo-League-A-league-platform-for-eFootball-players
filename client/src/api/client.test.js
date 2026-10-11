import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setUnauthorizedHandler } from './client.js';

const reply = (status, body, type = 'application/json') =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: type ? { 'Content-Type': type } : {},
  });

const stubFetch = (response) => {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => setUnauthorizedHandler(null));

describe('api client', () => {
  it('sends a JSON body with the session cookie', async () => {
    const fetchMock = stubFetch(reply(200, { success: true }));
    await api.post('/auth/login', { identifier: 'rahim', password: 'x' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('same-origin');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ identifier: 'rahim', password: 'x' });
  });

  it('sends no body or content type on a GET', async () => {
    const fetchMock = stubFetch(reply(200, { success: true }));
    await api.get('/auth/me');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  it('sends an empty object for a POST without a body', async () => {
    const fetchMock = stubFetch(reply(200, { success: true }));
    await api.post('/auth/logout');

    expect(fetchMock.mock.calls[0][1].body).toBe('{}');
  });

  it('returns the parsed body on success', async () => {
    stubFetch(reply(200, { success: true, user: { name: 'Rahim' } }));
    await expect(api.get('/auth/me')).resolves.toEqual({
      success: true,
      user: { name: 'Rahim' },
    });
  });

  it('throws an ApiError carrying the server message, code, details and request id', async () => {
    stubFetch(
      reply(403, {
        success: false,
        message: 'Change your password first',
        code: 'PASSWORD_CHANGE_REQUIRED',
        details: ['a', 'b'],
        requestId: 'req-1',
      })
    );

    const error = await api.get('/users').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Change your password first');
    expect(error.status).toBe(403);
    expect(error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect(error.details).toEqual(['a', 'b']);
    expect(error.requestId).toBe('req-1');
  });

  it('uses a friendly message when the error body is not JSON', async () => {
    stubFetch(reply(500, undefined, ''));

    const error = await api.get('/users').catch((e) => e);
    expect(error.status).toBe(500);
    expect(error.message).toBe('Something went wrong. Try again.');
  });

  it('says the server is not responding when a gateway reports it is down', async () => {
    stubFetch(reply(502, undefined, ''));

    const error = await api.get('/users').catch((e) => e);
    expect(error.status).toBe(502);
    expect(error.message).toBe('The server is not responding. Try again shortly.');
  });

  it('uses a friendly message when the JSON is malformed', async () => {
    stubFetch(
      new Response('{oops', { status: 500, headers: { 'Content-Type': 'application/json' } })
    );

    const error = await api.get('/users').catch((e) => e);
    expect(error.message).toBe('Something went wrong. Try again.');
  });

  it('explains a network failure instead of leaking the browser message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await api.get('/users').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/cannot reach the server/i);
  });

  it('tells the app when the session is no longer valid', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    stubFetch(reply(401, { success: false, message: 'Your session expired.' }));

    await expect(api.get('/users')).rejects.toThrow('Your session expired.');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not treat other errors as a lost session', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    stubFetch(reply(403, { success: false, message: 'Admin access only' }));

    await expect(api.get('/users')).rejects.toThrow('Admin access only');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
