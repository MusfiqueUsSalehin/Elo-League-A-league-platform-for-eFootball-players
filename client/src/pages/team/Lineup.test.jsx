import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { admin, callsTo, failure, jsonResponse, mockApi, player } from '../../test/fakeApi.js';
import { renderApp } from '../../test/renderApp.jsx';
import { arsenal, chelsea, keeper, squad, striker, teamDetail } from '../../test/teamFixtures.js';

const meAs = (user) => () => jsonResponse(200, { success: true, user });

function openLineup({ user = player, team = arsenal, members = squad, routes = {} } = {}) {
  const api = mockApi({
    'GET /api/auth/me': meAs(user),
    [`GET /api/teams/${team._id}`]: () => teamDetail(team, members),
    ...routes,
  });
  renderApp(`/teams/${team._id}/lineup`);
  return api;
}

const pitch = () => screen.getByRole('group', { name: 'Formation pitch' });
const slot = (name) => within(pitch()).getByRole('button', { name });
const slotsOnPitch = () => within(pitch()).getAllByRole('button');

const withLineup = (lineup, extra = {}) => ({ ...arsenal, lineup, ...extra });
const chooser = () => screen.getByRole('dialog', { name: /^Choose a / });

describe('the line-up screen', () => {
  it('shows the formation with eleven empty slots', async () => {
    openLineup();
    await screen.findByRole('group', { name: 'Formation pitch' });

    expect(slotsOnPitch()).toHaveLength(11);
    expect(slot('GK: empty')).toBeInTheDocument();
    expect(screen.getByText('of 11 starters picked')).toBeInTheDocument();
    expect(screen.getByLabelText('Formation')).toHaveValue('4-3-3');
    expect(screen.getByRole('button', { name: 'Save line-up' })).toBeDisabled();
  });

  it('shows the saved starters and keeps everyone else on the bench', async () => {
    openLineup({
      team: withLineup([
        { slot: 0, footballer: keeper._id },
        { slot: 10, footballer: striker._id },
      ]),
    });
    await screen.findByRole('group', { name: 'Formation pitch' });

    expect(slot('GK: David Raya, rated 85')).toBeInTheDocument();
    expect(slot('RWF: Erling Haaland, rated 95')).toBeInTheDocument();
    const bench = screen.getByRole('heading', { name: 'Bench' }).closest('div');
    expect(bench).toHaveTextContent('Bukayo Saka');
    expect(bench).toHaveTextContent('William Saliba');
    expect(bench).not.toHaveTextContent('David Raya');
  });

  it('offers the natural position first when choosing a player', async () => {
    openLineup();
    await userEvent.click(await screen.findByRole('button', { name: 'GK: empty' }));
    const dialog = chooser();

    expect(dialog).toHaveAccessibleName('Choose a GK');
    const names = within(dialog)
      .getAllByRole('button', { name: /^Pick / })
      .map((button) => button.getAttribute('aria-label').split(',')[0]);
    expect(names).toEqual([
      'Pick David Raya',
      'Pick Erling Haaland',
      'Pick Bukayo Saka',
      'Pick William Saliba',
    ]);
    expect(within(dialog).getByText('GK · natural position')).toBeInTheDocument();
  });

  it('puts the chosen player in the slot and marks the line-up as changed', async () => {
    openLineup();
    await userEvent.click(await screen.findByRole('button', { name: 'GK: empty' }));
    await userEvent.click(within(chooser()).getByRole('button', { name: /^Pick David Raya/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(slot('GK: David Raya, rated 85')).toBeInTheDocument();
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save line-up' })).toBeEnabled();
    expect(screen.getByText('1', { selector: '.scoreline' })).toBeInTheDocument();
  });

  it('saves the starters and the formation', async () => {
    let loads = 0;
    const api = openLineup({
      routes: {
        'GET /api/teams/t1': () => {
          loads += 1;
          return teamDetail(
            loads === 1
              ? arsenal
              : withLineup([{ slot: 0, footballer: keeper._id }], {
                  updatedAt: '2026-10-11T10:00:00.000Z',
                })
          );
        },
        'PUT /api/teams/t1/lineup': () => jsonResponse(200, { success: true, team: arsenal }),
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'GK: empty' }));
    await userEvent.click(within(chooser()).getByRole('button', { name: /^Pick David Raya/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save line-up' }));

    expect(callsTo(api, 'PUT /api/teams/t1/lineup')[0].body).toEqual({
      formation: '4-3-3',
      starters: [{ slot: 0, footballer: 'f1' }],
    });
    await waitFor(() =>
      expect(screen.queryByText('You have unsaved changes.')).not.toBeInTheDocument()
    );
    expect(slot('GK: David Raya, rated 85')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save line-up' })).toBeDisabled();
  });

  it('moves a player who is already starting instead of duplicating them', async () => {
    openLineup({ team: withLineup([{ slot: 0, footballer: keeper._id }]) });
    await userEvent.click(await screen.findByRole('button', { name: 'LB: empty' }));
    const dialog = chooser();

    expect(within(dialog).getByText('In the XI')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /^Pick David Raya/ }));

    expect(slot('GK: empty')).toBeInTheDocument();
    expect(slot('LB: David Raya, rated 85')).toBeInTheDocument();
    expect(screen.getByText('1', { selector: '.scoreline' })).toBeInTheDocument();
  });

  it('can take a player out of the XI', async () => {
    openLineup({ team: withLineup([{ slot: 0, footballer: keeper._id }]) });
    await userEvent.click(await screen.findByRole('button', { name: 'GK: David Raya, rated 85' }));
    const dialog = chooser();

    expect(within(dialog).getByText('Here now')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Take out of the XI' }));

    expect(slot('GK: empty')).toBeInTheDocument();
  });

  it('redraws the pitch for another formation and saves it', async () => {
    const api = openLineup({
      routes: {
        'PUT /api/teams/t1/lineup': () => jsonResponse(200, { success: true, team: arsenal }),
      },
    });
    await screen.findByRole('group', { name: 'Formation pitch' });
    expect(within(pitch()).queryByRole('button', { name: /^LMF/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Formation'), '4-4-2');

    expect(within(pitch()).getAllByRole('button', { name: /^LMF/ })).toHaveLength(1);
    expect(slotsOnPitch()).toHaveLength(11);
    await userEvent.click(screen.getByRole('button', { name: 'Save line-up' }));
    expect(callsTo(api, 'PUT /api/teams/t1/lineup')[0].body).toEqual({
      formation: '4-4-2',
      starters: [],
    });
  });

  it('discards unsaved changes', async () => {
    openLineup();
    await userEvent.click(await screen.findByRole('button', { name: 'GK: empty' }));
    await userEvent.click(within(chooser()).getByRole('button', { name: /^Pick David Raya/ }));
    await userEvent.selectOptions(screen.getByLabelText('Formation'), '3-5-2');

    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(slot('GK: empty')).toBeInTheDocument();
    expect(screen.getByLabelText('Formation')).toHaveValue('4-3-3');
    expect(screen.getByRole('button', { name: 'Save line-up' })).toBeDisabled();
  });

  it('shows the server message when saving fails and keeps the changes', async () => {
    openLineup({
      routes: { 'PUT /api/teams/t1/lineup': () => failure(400, 'A player can only start once') },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'GK: empty' }));
    await userEvent.click(within(chooser()).getByRole('button', { name: /^Pick David Raya/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save line-up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A player can only start once');
    expect(slot('GK: David Raya, rated 85')).toBeInTheDocument();
  });

  it('tells the manager to add players when the squad is empty', async () => {
    openLineup({ members: [] });
    await userEvent.click(await screen.findByRole('button', { name: 'GK: empty' }));

    expect(within(chooser()).getByText('Add players to the squad first.')).toBeInTheDocument();
  });

  it('flags a complete starting eleven', async () => {
    const members = Array.from({ length: 11 }, (_, i) => ({
      _id: `p${i}`,
      team: 't1',
      name: `Player ${i}`,
      position: 'CMF',
      rating: 70 + i,
    }));
    openLineup({
      members,
      team: withLineup(members.map((member, index) => ({ slot: index, footballer: member._id }))),
    });

    expect(await screen.findByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Everyone in the squad is starting.')).toBeInTheDocument();
  });

  it('is read-only for other players', async () => {
    openLineup({
      team: { ...chelsea, lineup: [{ slot: 0, footballer: keeper._id }] },
      members: squad.map((member) => ({ ...member, team: 't2' })),
    });
    await screen.findByRole('group', { name: 'Formation pitch' });

    expect(screen.getByText('Only the manager can change the line-up.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Formation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save line-up' })).not.toBeInTheDocument();
    expect(slot('GK: David Raya, rated 85')).toBeDisabled();
  });

  it('lets an admin edit any line-up', async () => {
    openLineup({ user: admin, team: chelsea, members: [] });

    expect(await screen.findByRole('button', { name: 'Save line-up' })).toBeInTheDocument();
    expect(slot('GK: empty')).toBeEnabled();
  });
});
