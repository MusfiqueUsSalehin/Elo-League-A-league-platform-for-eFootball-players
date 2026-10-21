import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { callsTo, failure, jsonResponse, mockApi, player } from '../test/fakeApi.js';
import { renderApp } from '../test/renderApp.jsx';

const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

const matchReady = {
  _id: 'n1',
  type: 'match',
  title: 'Match ready',
  body: 'Kick-off soon',
  link: '/dashboard',
  readAt: null,
  createdAt: hoursAgo(2),
};
const resultIn = {
  _id: 'n2',
  type: 'result',
  title: 'Result confirmed',
  body: '',
  link: '',
  readAt: null,
  createdAt: hoursAgo(5),
};
const oldNews = {
  _id: 'n3',
  type: 'announcement',
  title: 'Season starts',
  body: 'See you there',
  link: '',
  readAt: hoursAgo(1),
  createdAt: hoursAgo(30),
};
const allOn = {
  account: true,
  tournament: true,
  match: true,
  result: true,
  reminder: true,
  announcement: true,
  system: true,
};

const list = (items, extra = {}) =>
  jsonResponse(200, {
    success: true,
    items,
    total: items.length,
    unread: items.filter((item) => !item.readAt).length,
    page: 1,
    pages: 1,
    ...extra,
  });

const ok = () => jsonResponse(200, { success: true });

function openNotifications(routes = {}) {
  const api = mockApi({
    'GET /api/auth/me': () => jsonResponse(200, { success: true, user: player }),
    'GET /api/notifications': (_body, url) =>
      url.includes('unread=true')
        ? list([matchReady, resultIn])
        : list([matchReady, resultIn, oldNews]),
    'GET /api/notifications/unread-count': () => jsonResponse(200, { success: true, count: 2 }),
    'GET /api/notifications/preferences': () => jsonResponse(200, { success: true, email: allOn }),
    ...routes,
  });
  renderApp('/notifications');
  return api;
}

describe('the notifications page', () => {
  it('lists notifications and marks the unread ones', async () => {
    openNotifications();

    expect(await screen.findByText('Match ready')).toBeInTheDocument();
    expect(screen.getByText('Result confirmed')).toBeInTheDocument();
    expect(screen.getByText('Season starts')).toBeInTheDocument();
    expect(screen.getByText('2 h ago')).toBeInTheDocument();
    expect(screen.getAllByText('Unread')).toHaveLength(2);
  });

  it('shows the unread count next to Notifications in the navigation', async () => {
    openNotifications();

    expect(await screen.findByRole('link', { name: /Notifications.*2 unread/ })).toHaveAttribute(
      'href',
      '/notifications'
    );
  });

  it('can show only the unread ones', async () => {
    const api = openNotifications();
    await screen.findByText('Season starts');

    await userEvent.click(screen.getByRole('button', { name: 'Unread only' }));

    await waitFor(() => expect(screen.queryByText('Season starts')).not.toBeInTheDocument());
    expect(callsTo(api, 'GET /api/notifications').at(-1).url).toContain('unread=true');
    expect(screen.getByRole('button', { name: 'Unread only' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('marks a notification read and follows its link', async () => {
    const api = openNotifications({
      'POST /api/notifications/n1/read': () =>
        jsonResponse(200, { success: true, notification: matchReady }),
    });
    await userEvent.click(await screen.findByRole('button', { name: /Match ready/ }));

    expect(await screen.findByRole('heading', { name: 'Welcome back, Rahim' })).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/notifications/n1/read')).toHaveLength(1);
  });

  it('marks a notification without a link read and stays on the page', async () => {
    const api = openNotifications({ 'POST /api/notifications/n2/read': ok });
    await userEvent.click(await screen.findByRole('button', { name: /Result confirmed/ }));

    await waitFor(() => expect(callsTo(api, 'POST /api/notifications/n2/read')).toHaveLength(1));
    await waitFor(() => expect(callsTo(api, 'GET /api/notifications').length).toBeGreaterThan(1));
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('does not offer a button for something already read with nowhere to go', async () => {
    openNotifications();
    await screen.findByText('Season starts');

    expect(screen.queryByRole('button', { name: /Season starts/ })).not.toBeInTheDocument();
  });

  it('marks everything read', async () => {
    const api = openNotifications({ 'POST /api/notifications/read-all': ok });
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => expect(callsTo(api, 'POST /api/notifications/read-all')).toHaveLength(1));
  });

  it('says so when there is nothing to show', async () => {
    openNotifications({ 'GET /api/notifications': () => list([]) });
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Unread only' }));
    expect(await screen.findByText('You are all caught up.')).toBeInTheDocument();
  });

  it('shows the error and can try again', async () => {
    let attempts = 0;
    openNotifications({
      'GET /api/notifications': () => {
        attempts += 1;
        return attempts === 1 ? failure(500, 'Server error') : list([matchReady]);
      },
    });

    expect(await screen.findByText('Server error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Match ready')).toBeInTheDocument();
  });
});

describe('the email switches', () => {
  it('show one switch per kind, all on to start with', async () => {
    openNotifications();
    const switches = await screen.findAllByRole('switch');

    expect(switches).toHaveLength(7);
    for (const toggle of switches) expect(toggle).toBeChecked();
  });

  it('turn one kind off and remember it', async () => {
    const api = openNotifications({
      'PUT /api/notifications/preferences': () =>
        jsonResponse(200, { success: true, email: { ...allOn, match: false } }),
    });
    await userEvent.click(await screen.findByRole('switch', { name: 'Matches' }));

    expect(screen.getByRole('switch', { name: 'Matches' })).not.toBeChecked();
    await waitFor(() =>
      expect(callsTo(api, 'PUT /api/notifications/preferences')[0].body).toEqual({
        email: { match: false },
      })
    );
    expect(screen.getByRole('switch', { name: 'Results' })).toBeChecked();
  });

  it('put a switch back and explain when saving fails', async () => {
    openNotifications({
      'PUT /api/notifications/preferences': () => failure(500, 'Could not save that'),
    });
    await userEvent.click(await screen.findByRole('switch', { name: 'Matches' }));

    expect(await screen.findByText('Could not save that')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Matches' })).toBeChecked();
  });
});
