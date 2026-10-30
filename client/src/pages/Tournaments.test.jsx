import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, callsTo, failure, jsonResponse, mockApi, player } from '../test/fakeApi.js';
import { renderApp } from '../test/renderApp.jsx';

const spring = {
  _id: 'c1',
  name: 'Spring League',
  description: '',
  format: 'league',
  legs: 2,
  maxTeams: 8,
  requiresApproval: true,
  registrationDeadline: null,
  startsAt: null,
  status: 'registration',
  entries: { approved: 3, pending: 1 },
};
const winter = {
  ...spring,
  _id: 'c2',
  name: 'Winter Cup',
  format: 'knockout',
  legs: 1,
  status: 'draft',
};

const list = (items) =>
  jsonResponse(200, { success: true, items, total: items.length, page: 1, pages: 1 });
const meAs = (user) => () => jsonResponse(200, { success: true, user });

function openList(user = player, routes = {}) {
  const api = mockApi({
    'GET /api/auth/me': meAs(user),
    'GET /api/tournaments': () => list([spring]),
    ...routes,
  });
  renderApp('/tournaments');
  return api;
}

describe('the competitions list', () => {
  it('shows each competition with how it is played and how full it is', async () => {
    openList();
    const card = (await screen.findByRole('heading', { name: 'Spring League' })).closest('a');

    expect(card).toHaveAttribute('href', '/tournaments/c1');
    expect(card).toHaveTextContent('Open for entries');
    expect(card).toHaveTextContent('League, home and away');
    expect(card).toHaveTextContent('3 of 8 places filled, 1 waiting');
    expect(card).toHaveTextContent('No entry deadline');
  });

  it('only offers admins the button to create one', async () => {
    openList(player);
    await screen.findByRole('heading', { name: 'Spring League' });
    expect(screen.queryByRole('button', { name: 'New competition' })).not.toBeInTheDocument();
  });

  it('does not offer players the draft status filter', async () => {
    openList(player);
    await screen.findByRole('heading', { name: 'Spring League' });

    const options = within(screen.getByLabelText('Status')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).not.toContain('Draft');
  });

  it('searches after the typing pauses', async () => {
    const api = openList();
    await screen.findByRole('heading', { name: 'Spring League' });

    await userEvent.type(screen.getByLabelText('Search competitions'), 'spr');

    await waitFor(
      () => expect(callsTo(api, 'GET /api/tournaments').at(-1).url).toContain('q=spr'),
      {
        timeout: 2000,
      }
    );
  });

  it('says so when there are none', async () => {
    openList(player, { 'GET /api/tournaments': () => list([]) });
    expect(await screen.findByText('No competitions yet.')).toBeInTheDocument();
  });
});

describe('creating a competition', () => {
  const openDialog = async (routes = {}) => {
    const api = openList(admin, { 'GET /api/tournaments': () => list([winter]), ...routes });
    await userEvent.click(await screen.findByRole('button', { name: 'New competition' }));
    return { api, dialog: screen.getByRole('dialog', { name: 'New competition' }) };
  };

  it('checks the form before sending anything', async () => {
    const { api, dialog } = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create competition' }));

    expect(within(dialog).getByText('Enter a name of at least 2 characters')).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/tournaments')).toHaveLength(0);
  });

  it('creates it and opens its page', async () => {
    const created = { ...spring, _id: 'c9', name: 'Autumn Cup', status: 'draft' };
    const { api, dialog } = await openDialog({
      'POST /api/tournaments': () => jsonResponse(201, { success: true, tournament: created }),
      'GET /api/tournaments/c9': () => jsonResponse(200, { success: true, tournament: created }),
      'GET /api/tournaments/c9/entries': () => jsonResponse(200, { success: true, items: [] }),
    });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Autumn Cup');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create competition' }));

    expect(await screen.findByRole('heading', { name: 'Autumn Cup' })).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/tournaments')[0].body).toEqual({
      name: 'Autumn Cup',
      description: '',
      format: 'league',
      legs: 1,
      maxTeams: 8,
      requiresApproval: true,
      registrationDeadline: null,
      startsAt: null,
    });
  });

  it('shows the server message and stays open', async () => {
    const { dialog } = await openDialog({
      'POST /api/tournaments': () => failure(409, 'A competition with that name already exists'),
    });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Winter Cup');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create competition' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already exists');
  });
});
