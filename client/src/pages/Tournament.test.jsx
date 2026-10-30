import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, callsTo, failure, jsonResponse, mockApi, player } from '../test/fakeApi.js';
import { renderApp } from '../test/renderApp.jsx';

const cup = {
  _id: 'c1',
  name: 'Spring League',
  description: 'Everyone plays everyone.',
  format: 'league',
  legs: 1,
  maxTeams: 8,
  requiresApproval: true,
  registrationDeadline: null,
  startsAt: null,
  status: 'registration',
  entries: { approved: 1, pending: 1 },
};

const arsenal = {
  _id: 'e1',
  status: 'approved',
  seed: null,
  team: { _id: 't1', name: 'Arsenal' },
  owner: { _id: player._id, name: 'Rahim Uddin' },
};
const chelsea = {
  _id: 'e2',
  status: 'pending',
  seed: null,
  team: { _id: 't2', name: 'Chelsea' },
  owner: { _id: 'u9', name: 'Sadia Rahman' },
};

const meAs = (user) => () => jsonResponse(200, { success: true, user });
const ok = () => jsonResponse(200, { success: true });

function openCompetition({
  user = player,
  tournament = cup,
  entries = [arsenal, chelsea],
  routes = {},
} = {}) {
  const api = mockApi({
    'GET /api/auth/me': meAs(user),
    'GET /api/tournaments/c1': () => jsonResponse(200, { success: true, tournament }),
    'GET /api/tournaments/c1/entries': () => jsonResponse(200, { success: true, items: entries }),
    ...routes,
  });
  renderApp('/tournaments/c1');
  return api;
}

describe('the competition page', () => {
  it('shows the details and the teams', async () => {
    openCompetition();
    const table = await screen.findByRole('table', { name: 'Teams in Spring League' });

    expect(screen.getByRole('heading', { name: 'Spring League' })).toBeInTheDocument();
    expect(screen.getByText('Everyone plays everyone.')).toBeInTheDocument();
    expect(screen.getByText('Open for entries')).toBeInTheDocument();
    const arsenalRow = within(table).getByRole('row', { name: /Arsenal/ });
    expect(arsenalRow).toHaveTextContent('Rahim Uddin');
    expect(arsenalRow).toHaveTextContent('In');
    expect(within(table).getByRole('row', { name: /Chelsea/ })).toHaveTextContent('Waiting');
  });

  it('explains an unknown competition', async () => {
    mockApi({
      'GET /api/auth/me': meAs(player),
      'GET /api/tournaments/c1': () => failure(404, 'No such competition'),
      'GET /api/tournaments/c1/entries': () => failure(404, 'No such competition'),
    });
    renderApp('/tournaments/c1');

    expect(await screen.findByRole('alert')).toHaveTextContent('That competition does not exist.');
  });

  it('gives players no admin buttons', async () => {
    openCompetition();
    await screen.findByRole('table');

    for (const name of ['Edit', 'Open for entries', 'Cancel competition', 'Approve Chelsea']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('says so when nobody has entered', async () => {
    openCompetition({ entries: [] });
    expect(await screen.findByText('No teams have entered yet.')).toBeInTheDocument();
  });
});

describe('entering a team', () => {
  const myTeams = () =>
    jsonResponse(200, {
      success: true,
      items: [{ _id: 't7', name: 'Brighton', squadSize: 14 }],
      total: 1,
      page: 1,
      pages: 1,
    });

  it('lets a manager enter one of their teams', async () => {
    const api = openCompetition({
      entries: [chelsea],
      routes: {
        'GET /api/teams': myTeams,
        'POST /api/tournaments/c1/entries': () => jsonResponse(201, { success: true, entry: {} }),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Enter a team' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enter Spring League' });
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Enter team' }));

    await waitFor(() =>
      expect(callsTo(api, 'POST /api/tournaments/c1/entries')[0].body).toEqual({ teamId: 't7' })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server message when the entry is refused', async () => {
    openCompetition({
      entries: [chelsea],
      routes: {
        'GET /api/teams': myTeams,
        'POST /api/tournaments/c1/entries': () =>
          failure(409, 'A team needs at least 11 players to enter'),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Enter a team' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enter Spring League' });
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Enter team' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('at least 11 players');
  });

  it('points a manager with no team to the teams page', async () => {
    openCompetition({
      entries: [chelsea],
      routes: {
        'GET /api/teams': () =>
          jsonResponse(200, { success: true, items: [], total: 0, page: 1, pages: 1 }),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Enter a team' }));

    expect(await screen.findByRole('link', { name: 'Go to my teams' })).toHaveAttribute(
      'href',
      '/teams'
    );
  });

  it('does not offer it to a manager who is already in, or once entries have closed', async () => {
    openCompetition();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Enter a team' })).not.toBeInTheDocument();
  });

  it('does not offer it when registration is not open', async () => {
    openCompetition({ entries: [chelsea], tournament: { ...cup, status: 'active' } });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Enter a team' })).not.toBeInTheDocument();
  });

  it('lets a manager withdraw their own team after confirming', async () => {
    const api = openCompetition({ routes: { 'DELETE /api/tournaments/c1/entries/e1': ok } });
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw Arsenal' }));
    const dialog = screen.getByRole('dialog', { name: /Take Arsenal out of Spring League/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Take out' }));

    await waitFor(() =>
      expect(callsTo(api, 'DELETE /api/tournaments/c1/entries/e1')).toHaveLength(1)
    );
  });
});

describe('admin controls', () => {
  it('approves a waiting team', async () => {
    const api = openCompetition({
      user: admin,
      routes: { 'PATCH /api/tournaments/c1/entries/e2': ok },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Approve Chelsea' }));

    await waitFor(() =>
      expect(callsTo(api, 'PATCH /api/tournaments/c1/entries/e2')[0].body).toEqual({
        status: 'approved',
      })
    );
  });

  it('turns a waiting team down', async () => {
    const api = openCompetition({
      user: admin,
      routes: { 'PATCH /api/tournaments/c1/entries/e2': ok },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Turn down Chelsea' }));

    await waitFor(() =>
      expect(callsTo(api, 'PATCH /api/tournaments/c1/entries/e2')[0].body).toEqual({
        status: 'rejected',
      })
    );
  });

  it('opens entries on a draft', async () => {
    const api = openCompetition({
      user: admin,
      tournament: { ...cup, status: 'draft' },
      entries: [],
      routes: { 'POST /api/tournaments/c1/status': ok },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open for entries' }));

    await waitFor(() =>
      expect(callsTo(api, 'POST /api/tournaments/c1/status')[0].body).toEqual({
        status: 'registration',
      })
    );
  });

  it('cancels after confirming', async () => {
    const api = openCompetition({ user: admin, routes: { 'POST /api/tournaments/c1/status': ok } });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel competition' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel Spring League?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel competition' }));

    await waitFor(() =>
      expect(callsTo(api, 'POST /api/tournaments/c1/status')[0].body).toEqual({
        status: 'cancelled',
      })
    );
  });

  it('only offers going back to draft while nobody has entered', async () => {
    openCompetition({ user: admin });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Back to draft' })).not.toBeInTheDocument();
  });

  it('shows the server message when an action fails', async () => {
    openCompetition({
      user: admin,
      routes: {
        'PATCH /api/tournaments/c1/entries/e2': () => failure(409, 'The competition is full'),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Approve Chelsea' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The competition is full');
  });
});
