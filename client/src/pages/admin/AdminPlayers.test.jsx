import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  admin,
  callsTo,
  failure,
  jsonResponse,
  mockApi,
  player as signedInPlayer,
} from '../../test/fakeApi.js';
import { renderApp } from '../../test/renderApp.jsx';

const arman = {
  _id: 'p2',
  name: 'Arman Hossain',
  username: 'arman',
  email: 'arman@example.com',
  role: 'user',
  platform: 'PS5',
  elo: 1180,
  isActive: true,
};

const sadia = {
  _id: 'p3',
  name: 'Sadia Rahman',
  username: 'sadia',
  email: 'sadia@example.com',
  role: 'user',
  platform: 'Xbox',
  elo: 1320,
  isActive: false,
  lastLoginAt: '2026-09-01T12:00:00.000Z',
};

const listOf = (items, extra = {}) =>
  jsonResponse(200, { success: true, items, total: items.length, page: 1, pages: 1, ...extra });

const meAs = (user) => () => jsonResponse(200, { success: true, user });

/** An admin looking at the players page. `routes` adds or overrides endpoints. */
function openPlayersPage(routes = {}) {
  const api = mockApi({
    'GET /api/auth/me': meAs(admin),
    'GET /api/users': () => listOf([admin, arman, sadia]),
    ...routes,
  });
  renderApp('/admin/players');
  return api;
}

const dialogNamed = (name) => screen.getByRole('dialog', { name });

const fillNewPlayer = async () => {
  const dialog = dialogNamed('Add a player');
  await userEvent.type(within(dialog).getByLabelText('Full name'), 'Tanvir Ahmed');
  await userEvent.type(within(dialog).getByLabelText('Username'), 'tanvir');
  await userEvent.type(within(dialog).getByLabelText('Email'), 'tanvir@example.com');
  return dialog;
};

afterEach(() => {
  delete navigator.clipboard;
});

describe('access', () => {
  it('keeps players out and does not even ask the server for the list', async () => {
    const api = mockApi({ 'GET /api/auth/me': meAs(signedInPlayer) });
    renderApp('/admin/players');

    expect(await screen.findByRole('heading', { name: 'Admins only' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Players' })).not.toBeInTheDocument();
    expect(callsTo(api, 'GET /api/users')).toHaveLength(0);
  });

  it('shows admins the navigation link', async () => {
    openPlayersPage();

    expect(await screen.findByRole('link', { name: 'Players' })).toHaveAttribute(
      'href',
      '/admin/players'
    );
  });
});

describe('the player list', () => {
  it('lists every player with their role, status and last sign-in', async () => {
    openPlayersPage();
    const table = await screen.findByRole('table', { name: 'Players and their accounts' });

    expect(within(table).getAllByRole('row')).toHaveLength(4); // header + 3 players
    const armanRow = within(table).getByRole('row', { name: /Arman Hossain/ });
    expect(armanRow).toHaveTextContent('@arman · arman@example.com');
    expect(armanRow).toHaveTextContent('Active');
    expect(armanRow).toHaveTextContent('Never');

    const sadiaRow = within(table).getByRole('row', { name: /Sadia Rahman/ });
    expect(sadiaRow).toHaveTextContent('Inactive');
    expect(sadiaRow).toHaveTextContent('1 Sep 2026');
    expect(screen.getByText('3 players')).toBeInTheDocument();
  });

  it('marks the signed-in admin as you', async () => {
    openPlayersPage();
    const row = await screen.findByRole('row', { name: /League Admin/ });

    expect(row).toHaveTextContent('(you)');
  });

  it('searches after the typing pauses', async () => {
    const api = openPlayersPage();
    await screen.findByRole('table');

    await userEvent.type(screen.getByLabelText('Search players'), 'arm');

    await waitFor(() => expect(callsTo(api, 'GET /api/users').at(-1).url).toContain('q=arm'), {
      timeout: 2000,
    });
    // Typing three letters must not send three requests.
    expect(callsTo(api, 'GET /api/users')).toHaveLength(2);
  });

  it('filters by status and role', async () => {
    const api = openPlayersPage();
    await screen.findByRole('table');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'inactive');
    await waitFor(() =>
      expect(callsTo(api, 'GET /api/users').at(-1).url).toContain('status=inactive')
    );

    await userEvent.selectOptions(screen.getByLabelText('Role'), 'admin');
    await waitFor(() => expect(callsTo(api, 'GET /api/users').at(-1).url).toContain('role=admin'));
    expect(callsTo(api, 'GET /api/users').at(-1).url).toContain('status=inactive');
  });

  it('moves between pages', async () => {
    const api = openPlayersPage({
      'GET /api/users': (_body, url) =>
        url.includes('page=2')
          ? listOf([sadia], { page: 2, pages: 2, total: 11 })
          : listOf([arman], { page: 1, pages: 2, total: 11 }),
    });

    expect(await screen.findByText('Showing 1–10 of 11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('Showing 11–11 of 11')).toBeInTheDocument();
    expect(callsTo(api, 'GET /api/users').at(-1).url).toContain('page=2');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('goes back to the first page when a filter changes', async () => {
    const api = openPlayersPage({
      'GET /api/users': (_body, url) =>
        listOf([arman], { page: url.includes('page=2') ? 2 : 1, pages: 3, total: 25 }),
    });
    await screen.findByText('Showing 1–10 of 25');

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Showing 11–20 of 25');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'active');

    await waitFor(() => expect(callsTo(api, 'GET /api/users').at(-1).url).toContain('page=1'));
  });

  it('says so when nothing matches and lets the filters be cleared', async () => {
    openPlayersPage({
      'GET /api/users': (_body, url) =>
        url.includes('q=zzz') ? listOf([]) : listOf([admin, arman, sadia]),
    });
    await screen.findByRole('table');

    await userEvent.type(screen.getByLabelText('Search players'), 'zzz');
    expect(await screen.findByText('No players match these filters.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByLabelText('Search players')).toHaveValue('');
  });

  it('shows the error and can try again', async () => {
    let attempts = 0;
    openPlayersPage({
      'GET /api/users': () => {
        attempts += 1;
        return attempts === 1 ? failure(500, 'Server error') : listOf([admin, arman]);
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('adding a player', () => {
  const created = {
    user: { ...arman, _id: 'p9', name: 'Tanvir Ahmed', username: 'tanvir' },
    temporaryPassword: 'kT7m-Qx9w-Rb4e',
  };

  it('checks the form before sending anything', async () => {
    const api = openPlayersPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    const dialog = dialogNamed('Add a player');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(within(dialog).getByText('Enter a name of at least 2 characters')).toBeInTheDocument();
    expect(within(dialog).getByText(/Use 3-30 letters/)).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid email address')).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/users')).toHaveLength(0);
  });

  it('creates the account, shows the temporary password once and refreshes the list', async () => {
    const api = openPlayersPage({
      'POST /api/users': () => jsonResponse(201, { success: true, ...created }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    const dialog = await fillNewPlayer();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    const credentials = await screen.findByRole('dialog', { name: 'Account created' });
    expect(within(credentials).getByText('kT7m-Qx9w-Rb4e')).toBeInTheDocument();
    expect(within(credentials).getByText('tanvir')).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/users')[0].body).toEqual({
      name: 'Tanvir Ahmed',
      username: 'tanvir',
      email: 'tanvir@example.com',
      role: 'user',
      platform: 'Mobile',
    });
    await waitFor(() => expect(callsTo(api, 'GET /api/users').length).toBeGreaterThan(1));

    await userEvent.click(within(credentials).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('kT7m-Qx9w-Rb4e')).not.toBeInTheDocument();
  });

  it('sends the optional fields only when they are filled in', async () => {
    const api = openPlayersPage({
      'POST /api/users': () => jsonResponse(201, { success: true, ...created }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    const dialog = await fillNewPlayer();
    await userEvent.type(within(dialog).getByLabelText('Konami ID (optional)'), 'KON-123');
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'admin');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    await screen.findByRole('dialog', { name: 'Account created' });
    expect(callsTo(api, 'POST /api/users')[0].body).toMatchObject({
      konamiId: 'KON-123',
      role: 'admin',
    });
    expect(callsTo(api, 'POST /api/users')[0].body).not.toHaveProperty('phone');
  });

  it('keeps the form open and explains a duplicate username', async () => {
    openPlayersPage({
      'POST /api/users': () => failure(409, 'username is already taken'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    const dialog = await fillNewPlayer();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('username is already taken');
    expect(within(dialog).getByLabelText('Username')).toHaveValue('tanvir');
  });

  it('lists the details the server complains about', async () => {
    openPlayersPage({
      'POST /api/users': () =>
        failure(400, 'Some fields need fixing', { details: ['email: Invalid email'] }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    const dialog = await fillNewPlayer();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(await within(dialog).findByText('email: Invalid email')).toBeInTheDocument();
  });

  it('starts with an empty form every time', async () => {
    openPlayersPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    await userEvent.type(dialogNamed('Add a player').querySelector('input'), 'Half done');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Add player' }));
    expect(within(dialogNamed('Add a player')).getByLabelText('Full name')).toHaveValue('');
  });
});

describe('editing a player', () => {
  const edit = (name) => userEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));

  it('shows the saved details', async () => {
    openPlayersPage();
    await screen.findByRole('table');
    await edit('Arman Hossain');
    const dialog = dialogNamed('Edit player');

    expect(within(dialog).getByLabelText('Full name')).toHaveValue('Arman Hossain');
    expect(within(dialog).getByLabelText('Username')).toHaveValue('arman');
    expect(within(dialog).getByLabelText('Platform')).toHaveValue('PS5');
  });

  it('sends only what changed and refreshes the list', async () => {
    const api = openPlayersPage({
      'PATCH /api/users/p2': () => jsonResponse(200, { success: true, user: arman }),
    });
    await screen.findByRole('table');
    await edit('Arman Hossain');
    const dialog = dialogNamed('Edit player');
    const name = within(dialog).getByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Arman H.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'PATCH /api/users/p2')[0].body).toEqual({ name: 'Arman H.' });
    await waitFor(() => expect(callsTo(api, 'GET /api/users').length).toBeGreaterThan(1));
  });

  it('does not call the server when nothing changed', async () => {
    const api = openPlayersPage();
    await screen.findByRole('table');
    await edit('Arman Hossain');
    await userEvent.click(
      within(dialogNamed('Edit player')).getByRole('button', { name: 'Save changes' })
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'PATCH /api/users/p2')).toHaveLength(0);
  });

  it('does not let an admin change their own role', async () => {
    openPlayersPage();
    await screen.findByRole('table');
    await edit('League Admin');

    expect(within(dialogNamed('Edit player')).getByLabelText('Role')).toBeDisabled();
  });

  it('refreshes the sidebar when the admin edits themselves', async () => {
    const api = openPlayersPage({
      'PATCH /api/users/a1': () => jsonResponse(200, { success: true, user: admin }),
    });
    await screen.findByRole('table');
    await edit('League Admin');
    const dialog = dialogNamed('Edit player');
    await userEvent.type(within(dialog).getByLabelText('Full name'), ' Two');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(callsTo(api, 'GET /api/auth/me')).toHaveLength(2));
  });

  it('does not refresh the sidebar when someone else is edited', async () => {
    const api = openPlayersPage({
      'PATCH /api/users/p2': () => jsonResponse(200, { success: true, user: arman }),
    });
    await screen.findByRole('table');
    await edit('Arman Hossain');
    const dialog = dialogNamed('Edit player');
    await userEvent.type(within(dialog).getByLabelText('Full name'), ' Jr');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'GET /api/auth/me')).toHaveLength(1);
  });
});

describe('deactivating and reactivating', () => {
  it('asks first, and does nothing if the admin cancels', async () => {
    const api = openPlayersPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Arman Hossain' }));

    const dialog = dialogNamed('Deactivate Arman Hossain?');
    expect(dialog).toHaveTextContent('signed out straight away');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsTo(api, 'PATCH /api/users/p2')).toHaveLength(0);
  });

  it('deactivates once confirmed', async () => {
    const api = openPlayersPage({
      'PATCH /api/users/p2': () => jsonResponse(200, { success: true, user: arman }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Arman Hossain' }));
    await userEvent.click(
      within(dialogNamed('Deactivate Arman Hossain?')).getByRole('button', {
        name: 'Deactivate',
      })
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'PATCH /api/users/p2')[0].body).toEqual({ isActive: false });
    await waitFor(() => expect(callsTo(api, 'GET /api/users').length).toBeGreaterThan(1));
  });

  it('reactivates an inactive player', async () => {
    const api = openPlayersPage({
      'PATCH /api/users/p3': () => jsonResponse(200, { success: true, user: sadia }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Reactivate Sadia Rahman' }));
    await userEvent.click(
      within(dialogNamed('Reactivate Sadia Rahman?')).getByRole('button', {
        name: 'Reactivate',
      })
    );

    await waitFor(() => expect(callsTo(api, 'PATCH /api/users/p3')).toHaveLength(1));
    expect(callsTo(api, 'PATCH /api/users/p3')[0].body).toEqual({ isActive: true });
  });

  it('shows the server message and stays open when it fails', async () => {
    openPlayersPage({
      'PATCH /api/users/p2': () => failure(500, 'Server error'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Arman Hossain' }));
    const dialog = dialogNamed('Deactivate Arman Hossain?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Server error');
    expect(within(dialog).getByRole('button', { name: 'Deactivate' })).toBeEnabled();
  });

  it('keeps admins from deactivating or resetting themselves', async () => {
    openPlayersPage();

    expect(await screen.findByRole('button', { name: 'Deactivate League Admin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset password for League Admin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit League Admin' })).toBeEnabled();
  });
});

describe('resetting a password', () => {
  const reset = { success: true, temporaryPassword: 'Zx4n-Pq7r-Lm2k' };

  it('shows the new temporary password once confirmed', async () => {
    const api = openPlayersPage({
      'POST /api/users/p2/reset-password': () => jsonResponse(200, reset),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reset password for Arman Hossain' })
    );
    await userEvent.click(
      within(dialogNamed('Reset password for Arman Hossain?')).getByRole('button', {
        name: 'Reset password',
      })
    );

    const credentials = await screen.findByRole('dialog', { name: 'Password reset' });
    expect(within(credentials).getByText('Zx4n-Pq7r-Lm2k')).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/users/p2/reset-password')).toHaveLength(1);

    await userEvent.click(within(credentials).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('Zx4n-Pq7r-Lm2k')).not.toBeInTheDocument();
  });

  it('copies the password to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    openPlayersPage({ 'POST /api/users/p2/reset-password': () => jsonResponse(200, reset) });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reset password for Arman Hossain' })
    );
    await userEvent.click(
      within(dialogNamed('Reset password for Arman Hossain?')).getByRole('button', {
        name: 'Reset password',
      })
    );
    await userEvent.click(await screen.findByRole('button', { name: /Copy password for/ }));

    expect(writeText).toHaveBeenCalledWith('Zx4n-Pq7r-Lm2k');
    expect(await screen.findByText('Copied to the clipboard.')).toBeInTheDocument();
  });

  it('tells the admin to copy by hand when the browser refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    openPlayersPage({ 'POST /api/users/p2/reset-password': () => jsonResponse(200, reset) });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reset password for Arman Hossain' })
    );
    await userEvent.click(
      within(dialogNamed('Reset password for Arman Hossain?')).getByRole('button', {
        name: 'Reset password',
      })
    );
    await userEvent.click(await screen.findByRole('button', { name: /Copy password for/ }));

    expect(await screen.findByText(/Could not copy automatically/)).toBeInTheDocument();
  });
});
