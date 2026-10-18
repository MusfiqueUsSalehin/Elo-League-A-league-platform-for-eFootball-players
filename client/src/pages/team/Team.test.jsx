import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, callsTo, failure, jsonResponse, mockApi, player } from '../../test/fakeApi.js';
import { renderApp } from '../../test/renderApp.jsx';
import { arsenal, chelsea, keeper, squad, teamDetail, teamList } from '../../test/teamFixtures.js';

const meAs = (user) => () => jsonResponse(200, { success: true, user });
const ok = () => jsonResponse(200, { success: true });

/** Opens a team as `user`. `routes` adds or overrides endpoints. */
function openTeam({ user = player, team = arsenal, members = squad, routes = {} } = {}) {
  const api = mockApi({
    'GET /api/auth/me': meAs(user),
    [`GET /api/teams/${team._id}`]: () => teamDetail(team, members),
    ...routes,
  });
  renderApp(`/teams/${team._id}`);
  return api;
}

const dialogNamed = (name) => screen.getByRole('dialog', { name });

describe('the team page', () => {
  it('shows the team, its manager and the squad best rated first', async () => {
    openTeam();
    const table = await screen.findByRole('table', { name: 'Players in Arsenal' });

    expect(screen.getByRole('heading', { name: 'Arsenal' })).toBeInTheDocument();
    expect(screen.getByText('Managed by Rahim Uddin')).toBeInTheDocument();
    expect(screen.getByText('89.5 average rating')).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      'Erling Haaland',
      'Bukayo Saka',
      'William Saliba',
      'David Raya',
    ]);
    expect(screen.getByText('4 of 40 players')).toBeInTheDocument();
  });

  it('marks who is in the starting line-up', async () => {
    openTeam({ team: { ...arsenal, lineup: [{ slot: 0, footballer: keeper._id }] } });
    const row = await screen.findByRole('row', { name: /David Raya/ });

    expect(row).toHaveTextContent('Starting');
    expect(screen.getByRole('row', { name: /Erling Haaland/ })).not.toHaveTextContent('Starting');
  });

  it('links to the squad and the line-up', async () => {
    openTeam();
    await screen.findByRole('table');

    expect(screen.getByRole('link', { name: 'Squad' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Line-up' })).toHaveAttribute(
      'href',
      '/teams/t1/lineup'
    );
  });

  it('explains an unknown team', async () => {
    mockApi({
      'GET /api/auth/me': meAs(player),
      'GET /api/teams/nope': () => failure(404, 'No such team'),
    });
    renderApp('/teams/nope');

    expect(await screen.findByRole('alert')).toHaveTextContent('That team does not exist.');
    expect(screen.getByRole('link', { name: 'Back to teams' })).toHaveAttribute('href', '/teams');
  });

  it('gives other players a read-only view', async () => {
    openTeam({ team: chelsea, members: squad.map((p) => ({ ...p, team: 't2' })) });
    await screen.findByRole('table');

    expect(screen.getByText('Managed by Sadia Rahman')).toBeInTheDocument();
    for (const name of ['Add player', 'Paste squad', 'Edit team', 'Delete team']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
  });

  it('lets an admin manage any team', async () => {
    openTeam({ user: admin });

    expect(await screen.findByRole('button', { name: 'Add player' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete team' })).toBeInTheDocument();
  });

  it('says so when the squad is empty', async () => {
    openTeam({ members: [] });
    expect(await screen.findByText(/The squad is empty/)).toBeInTheDocument();
  });
});

describe('managing the squad', () => {
  it('checks the form before sending anything', async () => {
    const api = openTeam();
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    const dialog = dialogNamed('Add a player');
    await userEvent.type(within(dialog).getByLabelText('Rating'), '500');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add to squad' }));

    expect(within(dialog).getByText('Enter a name of at least 2 characters')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a whole number from 1 to 120')).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/teams/t1/squad')).toHaveLength(0);
  });

  it('adds a player and refreshes the squad', async () => {
    const api = openTeam({
      routes: {
        'POST /api/teams/t1/squad': () => jsonResponse(201, { success: true, footballer: {} }),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    const dialog = dialogNamed('Add a player');
    await userEvent.type(within(dialog).getByLabelText('Player name'), ' Martin Odegaard ');
    await userEvent.selectOptions(within(dialog).getByLabelText('Position'), 'AMF');
    await userEvent.type(within(dialog).getByLabelText('Rating'), '91');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add to squad' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'POST /api/teams/t1/squad')[0].body).toEqual({
      name: 'Martin Odegaard',
      position: 'AMF',
      rating: 91,
    });
    expect(callsTo(api, 'GET /api/teams/t1').length).toBeGreaterThan(1);
  });

  it('shows the server message for a duplicate and keeps the form open', async () => {
    openTeam({
      routes: {
        'POST /api/teams/t1/squad': () => failure(409, 'That player is already in the squad'),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    const dialog = dialogNamed('Add a player');
    await userEvent.type(within(dialog).getByLabelText('Player name'), 'Bukayo Saka');
    await userEvent.type(within(dialog).getByLabelText('Rating'), '90');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add to squad' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'That player is already in the squad'
    );
  });

  it('edits a player and sends only what changed', async () => {
    const api = openTeam({
      routes: {
        'PATCH /api/teams/t1/squad/f3': () => jsonResponse(200, { success: true, footballer: {} }),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Bukayo Saka' }));
    const dialog = dialogNamed('Edit player');
    expect(within(dialog).getByLabelText('Rating')).toHaveValue(90);
    await userEvent.clear(within(dialog).getByLabelText('Rating'));
    await userEvent.type(within(dialog).getByLabelText('Rating'), '92');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'PATCH /api/teams/t1/squad/f3')[0].body).toEqual({ rating: 92 });
  });

  it('does not call the server when an edit changes nothing', async () => {
    const api = openTeam();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Bukayo Saka' }));
    await userEvent.click(
      within(dialogNamed('Edit player')).getByRole('button', { name: 'Save changes' })
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'PATCH /api/teams/t1/squad/f3')).toHaveLength(0);
  });

  it('asks before removing a player, and removes them once confirmed', async () => {
    const api = openTeam({ routes: { 'DELETE /api/teams/t1/squad/f2': ok } });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove William Saliba' }));
    const dialog = dialogNamed('Remove William Saliba?');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(callsTo(api, 'DELETE /api/teams/t1/squad/f2')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Remove William Saliba' }));
    await userEvent.click(
      within(dialogNamed('Remove William Saliba?')).getByRole('button', { name: 'Remove player' })
    );

    await waitFor(() => expect(callsTo(api, 'DELETE /api/teams/t1/squad/f2')).toHaveLength(1));
  });
});

describe('pasting a squad', () => {
  const importUrl = 'POST /api/teams/t1/squad/import';

  const paste = async (text) => {
    await userEvent.click(await screen.findByRole('button', { name: 'Paste squad' }));
    const dialog = dialogNamed('Paste a squad');
    await userEvent.click(within(dialog).getByLabelText('Squad list'));
    await userEvent.paste(text);
    return dialog;
  };

  it('keeps the button off until there is something to send', async () => {
    openTeam();
    await userEvent.click(await screen.findByRole('button', { name: 'Paste squad' }));

    expect(
      within(dialogNamed('Paste a squad')).getByRole('button', { name: 'Add players' })
    ).toBeDisabled();
  });

  it('sends the text and reports what was added and what was skipped', async () => {
    const api = openTeam({
      routes: {
        [importUrl]: () =>
          jsonResponse(201, {
            success: true,
            added: [{ _id: 'n1' }, { _id: 'n2' }],
            skipped: [
              { line: 3, text: 'oops', reason: 'Expected a name, a position and a rating' },
            ],
          }),
      },
    });
    const dialog = await paste('A One, GK, 80\nB Two, CB, 81\noops');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add players' }));

    expect(await within(dialog).findByText('2 players added.')).toBeInTheDocument();
    expect(within(dialog).getByText('1 line was skipped:')).toBeInTheDocument();
    expect(within(dialog).getByText(/Line 3:/)).toBeInTheDocument();
    expect(within(dialog).getByText('oops')).toBeInTheDocument();
    expect(callsTo(api, importUrl)[0].body).toEqual({ text: 'A One, GK, 80\nB Two, CB, 81\noops' });
    await waitFor(() => expect(callsTo(api, 'GET /api/teams/t1').length).toBeGreaterThan(1));

    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the server message when the paste is rejected and keeps the text', async () => {
    openTeam({
      routes: { [importUrl]: () => failure(400, 'Paste at most 60 players at a time') },
    });
    const dialog = await paste('A One, GK, 80');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add players' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('at most 60');
    expect(within(dialog).getByLabelText('Squad list')).toHaveValue('A One, GK, 80');
  });
});

describe('editing and deleting the team', () => {
  it('renames the team and sends only the change', async () => {
    const api = openTeam({
      routes: { 'PATCH /api/teams/t1': () => jsonResponse(200, { success: true, team: arsenal }) },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit team' }));
    const dialog = dialogNamed('Edit team');
    await userEvent.clear(within(dialog).getByLabelText('Team name'));
    await userEvent.type(within(dialog).getByLabelText('Team name'), 'Gunners');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(api, 'PATCH /api/teams/t1')[0].body).toEqual({ name: 'Gunners' });
  });

  it('deletes the team after confirmation and returns to the list', async () => {
    const api = openTeam({
      routes: {
        'DELETE /api/teams/t1': ok,
        'GET /api/teams': () => teamList([]),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete team' }));
    await userEvent.click(
      within(dialogNamed('Delete Arsenal?')).getByRole('button', { name: 'Delete team' })
    );

    expect(await screen.findByRole('heading', { name: 'Teams' })).toBeInTheDocument();
    expect(callsTo(api, 'DELETE /api/teams/t1')).toHaveLength(1);
  });

  it('keeps the team when the delete is cancelled', async () => {
    const api = openTeam({ routes: { 'DELETE /api/teams/t1': ok } });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete team' }));
    await userEvent.click(
      within(dialogNamed('Delete Arsenal?')).getByRole('button', { name: 'Cancel' })
    );

    expect(callsTo(api, 'DELETE /api/teams/t1')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Arsenal' })).toBeInTheDocument();
  });
});
