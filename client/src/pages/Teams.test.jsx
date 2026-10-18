import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { callsTo, failure, jsonResponse, mockApi, player } from '../test/fakeApi.js';
import { renderApp } from '../test/renderApp.jsx';
import { arsenal, chelsea, teamDetail, teamList } from '../test/teamFixtures.js';

const meAs = (user) => () => jsonResponse(200, { success: true, user });

function openTeams(routes = {}) {
  const api = mockApi({
    'GET /api/auth/me': meAs(player),
    'GET /api/teams': (_body, url) =>
      url.includes('mine=true') ? teamList([arsenal]) : teamList([arsenal, chelsea]),
    ...routes,
  });
  renderApp('/teams');
  return api;
}

describe('the teams list', () => {
  it('shows my teams first, with their details', async () => {
    const api = openTeams();
    const card = (await screen.findByRole('heading', { name: 'Arsenal' })).closest('a');

    expect(callsTo(api, 'GET /api/teams')[0].url).toContain('mine=true');
    expect(card).toHaveAttribute('href', '/teams/t1');
    expect(card).toHaveTextContent('Managed by Rahim Uddin');
    expect(card).toHaveTextContent('4-3-3');
    expect(card).toHaveTextContent('4 players · 89.5 avg');
    expect(card).toHaveTextContent('Yours');
    expect(screen.queryByText('Chelsea')).not.toBeInTheDocument();
  });

  it('can show every team, and marks only mine as yours', async () => {
    const api = openTeams();
    await screen.findByRole('heading', { name: 'Arsenal' });

    await userEvent.click(screen.getByRole('button', { name: 'All teams' }));

    const other = (await screen.findByRole('heading', { name: 'Chelsea' })).closest('a');
    expect(callsTo(api, 'GET /api/teams').at(-1).url).not.toContain('mine=true');
    expect(other).toHaveTextContent('Managed by Sadia Rahman');
    expect(other).toHaveTextContent('0 players');
    expect(other).not.toHaveTextContent('Yours');
    expect(screen.getByRole('button', { name: 'All teams' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'My teams' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('searches after the typing pauses', async () => {
    const api = openTeams();
    await screen.findByRole('heading', { name: 'Arsenal' });

    await userEvent.type(screen.getByLabelText('Search teams'), 'che');

    await waitFor(() => expect(callsTo(api, 'GET /api/teams').at(-1).url).toContain('q=che'), {
      timeout: 2000,
    });
  });

  it('invites a new player to create a first team', async () => {
    openTeams({ 'GET /api/teams': () => teamList([]) });

    expect(await screen.findByText('You do not have a team yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create your first team' })).toBeInTheDocument();
  });

  it('says so when a search finds nothing', async () => {
    openTeams({ 'GET /api/teams': () => teamList([]) });
    await screen.findByText('You do not have a team yet.');

    await userEvent.type(screen.getByLabelText('Search teams'), 'zzz');

    expect(await screen.findByText('No teams match.')).toBeInTheDocument();
  });

  it('shows the error and can try again', async () => {
    let attempts = 0;
    openTeams({
      'GET /api/teams': () => {
        attempts += 1;
        return attempts === 1 ? failure(500, 'Server error') : teamList([arsenal]);
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Arsenal' })).toBeInTheDocument();
  });

  it('adds Teams to the navigation', async () => {
    openTeams();

    expect(await screen.findByRole('link', { name: 'Teams' })).toHaveAttribute('href', '/teams');
  });
});

describe('creating a team', () => {
  const created = { ...arsenal, _id: 't9', name: 'Red Devils', formation: '4-4-2' };

  const openDialog = async (routes) => {
    const api = openTeams(routes);
    await userEvent.click(await screen.findByRole('button', { name: 'New team' }));
    return { api, dialog: screen.getByRole('dialog', { name: 'Create a team' }) };
  };

  it('checks the name first', async () => {
    const { api, dialog } = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }));

    expect(within(dialog).getByText('Enter a name of at least 2 characters')).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/teams')).toHaveLength(0);
  });

  it('creates the team and opens its page', async () => {
    const { api, dialog } = await openDialog({
      'POST /api/teams': () => jsonResponse(201, { success: true, team: created }),
      'GET /api/teams/t9': () => teamDetail(created, []),
    });
    await userEvent.type(within(dialog).getByLabelText('Team name'), '  Red Devils ');
    await userEvent.selectOptions(within(dialog).getByLabelText('Formation'), '4-4-2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }));

    expect(await screen.findByRole('heading', { name: 'Red Devils' })).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/teams')[0].body).toEqual({
      name: 'Red Devils',
      formation: '4-4-2',
    });
  });

  it('explains a duplicate name and stays open', async () => {
    const { dialog } = await openDialog({
      'POST /api/teams': () => failure(409, 'You already have a team with that name'),
    });
    await userEvent.type(within(dialog).getByLabelText('Team name'), 'Arsenal');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You already have a team with that name'
    );
    expect(within(dialog).getByLabelText('Team name')).toHaveValue('Arsenal');
  });
});
