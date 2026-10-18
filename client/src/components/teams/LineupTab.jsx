import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { api } from '../../api/client.js';
import Pitch from '../../components/teams/Pitch.jsx';
import { Alert, Badge, Button, Card, Modal, SelectField } from '../../components/ui/index.jsx';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import { FORMATIONS, FORMATION_KEYS } from '../../lib/formations.js';
import {
  STARTERS_NEEDED,
  assignToSlot,
  clearSlot,
  isComplete,
  lineupFromTeam,
  orderForSlot,
  sameLineup,
  startersFrom,
  startingIds,
} from '../../lib/lineup.js';

function PickerBody({ slotLabel, squad, lineup, slot, onPick, onClear, onClose }) {
  const starting = startingIds(lineup);
  const current = lineup[slot];

  if (squad.length === 0) {
    return <p className="text-sm text-mist">Add players to the squad first.</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="max-h-80 space-y-1.5 overflow-y-auto">
        {orderForSlot(squad, slotLabel).map((player) => (
          <li key={player._id}>
            <button
              type="button"
              onClick={() => onPick(player._id)}
              aria-label={`Pick ${player.name}, ${player.position}, rated ${player.rating}`}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-turf-900 px-3 py-2 text-left text-sm transition-colors hover:border-flood/50"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{player.name}</span>
                <span className="text-xs text-mist">
                  {player.position}
                  {player.position === slotLabel && ' · natural position'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {player._id === current && <Badge tone="gold">Here now</Badge>}
                {player._id !== current && starting.has(player._id) && <Badge>In the XI</Badge>}
                <span className="scoreline text-lg">{player.rating}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-2">
        {current ? (
          <Button variant="danger" size="sm" onClick={onClear}>
            Take out of the XI
          </Button>
        ) : (
          <span />
        )}
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function LineupEditor({ team, squad, canEdit, reload }) {
  usePageTitle(`${team.name} line-up`);
  const saved = useMemo(() => lineupFromTeam(team), [team]);
  const [formation, setFormation] = useState(team.formation);
  const [lineup, setLineup] = useState(saved);
  const [slot, setSlot] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const playersById = useMemo(() => new Map(squad.map((player) => [player._id, player])), [squad]);
  const slots = FORMATIONS[formation];
  const dirty = formation !== team.formation || !sameLineup(lineup, saved);
  const picked = Object.keys(lineup).length;
  const bench = squad.filter((player) => !startingIds(lineup).has(player._id));

  const pick = (footballerId) => {
    setLineup(assignToSlot(lineup, slot, footballerId));
    setSlot(null);
  };
  const clear = () => {
    setLineup(clearSlot(lineup, slot));
    setSlot(null);
  };
  const discard = () => {
    setFormation(team.formation);
    setLineup(saved);
    setError('');
  };

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      await api.put(`/teams/${team._id}/lineup`, { formation, starters: startersFrom(lineup) });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Line-up" className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
      <div className="space-y-4">
        {canEdit && (
          <SelectField
            label="Formation"
            value={formation}
            onChange={(event) => setFormation(event.target.value)}
          >
            {FORMATION_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </SelectField>
        )}
        <Pitch
          slots={slots}
          lineup={lineup}
          playersById={playersById}
          selectedSlot={slot}
          onSelect={setSlot}
          readOnly={!canEdit}
        />
      </div>

      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <p aria-live="polite" className="text-sm">
            <span className="scoreline text-2xl">{picked}</span>
            <span className="text-mist"> of {STARTERS_NEEDED} starters picked</span>
            {isComplete(lineup) && <Badge tone="green">Complete</Badge>}
          </p>
          {canEdit ? (
            <>
              <p className="text-xs text-mist">
                Select a spot on the pitch to choose who plays there.
              </p>
              {error && <Alert tone="error">{error}</Alert>}
              <div className="flex gap-2">
                <Button onClick={save} loading={busy} disabled={!dirty}>
                  Save line-up
                </Button>
                <Button variant="ghost" onClick={discard} disabled={!dirty || busy}>
                  Discard changes
                </Button>
              </div>
              {dirty && <p className="text-xs text-flood">You have unsaved changes.</p>}
            </>
          ) : (
            <p className="text-xs text-mist">Only the manager can change the line-up.</p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-display text-xl">Bench</h2>
          {bench.length === 0 ? (
            <p className="mt-2 text-sm text-mist">
              {squad.length === 0 ? 'The squad is empty.' : 'Everyone in the squad is starting.'}
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {bench.map((player) => (
                <li key={player._id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {player.name} <span className="text-xs text-mist">{player.position}</span>
                  </span>
                  <span className="scoreline">{player.rating}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={slot !== null}
        onClose={() => setSlot(null)}
        title={`Choose a ${slots[slot]?.label ?? 'player'}`}
        description="The natural position is listed first."
      >
        <PickerBody
          slotLabel={slots[slot]?.label}
          squad={squad}
          lineup={lineup}
          slot={slot}
          onPick={pick}
          onClear={clear}
          onClose={() => setSlot(null)}
        />
      </Modal>
    </section>
  );
}

/** Keyed on the last save, so the editor starts again from the server's copy after saving. */
export default function LineupTab() {
  const context = useOutletContext();
  return <LineupEditor key={context.team.updatedAt} {...context} />;
}
