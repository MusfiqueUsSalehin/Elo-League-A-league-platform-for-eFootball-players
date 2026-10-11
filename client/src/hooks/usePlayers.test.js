import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toQuery, usePlayers } from './usePlayers.js';
import { callsTo, jsonResponse, mockApi } from '../test/fakeApi.js';

describe('toQuery', () => {
  it('leaves out empty values', () => {
    expect(toQuery({ q: '', role: 'admin', status: undefined, page: 2, limit: 10 })).toBe(
      'role=admin&page=2&limit=10'
    );
  });
});

describe('usePlayers', () => {
  it('loads a page and exposes it', async () => {
    const api = mockApi({
      'GET /api/users': () => jsonResponse(200, { items: [{ _id: '1' }], total: 1, pages: 1 }),
    });
    const { result } = renderHook(() => usePlayers({ page: 1, limit: 10 }));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data.items).toHaveLength(1);
    expect(callsTo(api, 'GET /api/users')[0].url).toBe('/api/users?page=1&limit=10');
  });

  it('reports a failure and can try again', async () => {
    let attempt = 0;
    mockApi({
      'GET /api/users': () => {
        attempt += 1;
        return attempt === 1
          ? jsonResponse(500, { success: false, message: 'Server error' })
          : jsonResponse(200, { items: [], total: 0, pages: 0 });
      },
    });
    const { result } = renderHook(() => usePlayers({ page: 1 }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Server error');

    result.current.reload();
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('ignores a slow answer that arrives after the filters changed', async () => {
    let releaseFirst;
    mockApi({
      'GET /api/users': (_body, url) =>
        url.includes('q=old')
          ? new Promise((resolve) => {
              releaseFirst = () =>
                resolve(jsonResponse(200, { items: [{ _id: 'old' }], total: 1, pages: 1 }));
            })
          : jsonResponse(200, { items: [{ _id: 'new' }], total: 1, pages: 1 }),
    });
    const { result, rerender } = renderHook(({ q }) => usePlayers({ q }), {
      initialProps: { q: 'old' },
    });

    rerender({ q: 'new' });
    await waitFor(() => expect(result.current.data?.items[0]._id).toBe('new'));

    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.data.items[0]._id).toBe('new');
  });
});
