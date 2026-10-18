import { ClipboardPaste, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { api } from '../../api/client.js';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import FootballerFormDialog from '../../components/teams/FootballerFormDialog.jsx';
import ImportSquadDialog from '../../components/teams/ImportSquadDialog.jsx';
import { Badge, Button, Card } from '../../components/ui/index.jsx';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import { MAX_SQUAD_SIZE } from '../../lib/constants.js';
import { lineupFromTeam, startingIds } from '../../lib/lineup.js';

export default function SquadTab() {
  const { team, squad, canEdit, reload } = useOutletContext();
  usePageTitle(`${team.name} squad`);
  const [dialog, setDialog] = useState(null); // { type, footballer? }

  const starting = startingIds(lineupFromTeam(team));
  const closeDialog = () => setDialog(null);
  const saved = () => {
    closeDialog();
    reload();
  };

  const removeFootballer = async () => {
    await api.delete(`/teams/${team._id}/squad/${dialog.footballer._id}`);
    saved();
  };

  return (
    <section aria-label="Squad" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-mist">
          {squad.length} of {MAX_SQUAD_SIZE} players
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDialog({ type: 'import' })}>
              <ClipboardPaste size={14} aria-hidden="true" />
              Paste squad
            </Button>
            <Button size="sm" onClick={() => setDialog({ type: 'form' })}>
              <UserPlus size={14} aria-hidden="true" />
              Add player
            </Button>
          </div>
        )}
      </div>

      {squad.length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-mist">
          {canEdit
            ? 'The squad is empty. Add players one by one, or paste the whole list.'
            : 'This squad has no players yet.'}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto" role="region" aria-label="Squad table" tabIndex={0}>
            <table className="w-full min-w-[32rem] text-left">
              <caption className="sr-only">Players in {team.name}</caption>
              <thead className="text-xs uppercase tracking-wide text-mist">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Player
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Position
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Rating
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Line-up
                  </th>
                  {canEdit && (
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {squad.map((player) => (
                  <tr key={player._id} className="border-t border-line align-middle">
                    <td className="px-4 py-3 font-medium">{player.name}</td>
                    <td className="px-4 py-3 text-sm text-mist">{player.position}</td>
                    <td className="scoreline px-4 py-3 text-xl">{player.rating}</td>
                    <td className="px-4 py-3">
                      {starting.has(player._id) ? <Badge tone="green">Starting</Badge> : null}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${player.name}`}
                            onClick={() => setDialog({ type: 'form', footballer: player })}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            aria-label={`Remove ${player.name}`}
                            onClick={() => setDialog({ type: 'remove', footballer: player })}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <FootballerFormDialog
        open={dialog?.type === 'form'}
        teamId={team._id}
        footballer={dialog?.footballer}
        onClose={closeDialog}
        onSaved={saved}
      />
      <ImportSquadDialog
        open={dialog?.type === 'import'}
        teamId={team._id}
        onImported={reload}
        onClose={closeDialog}
      />
      <ConfirmDialog
        open={dialog?.type === 'remove'}
        title={`Remove ${dialog?.footballer?.name}?`}
        confirmLabel="Remove player"
        tone="danger"
        onConfirm={removeFootballer}
        onCancel={closeDialog}
      >
        They leave the squad, and the starting line-up if they were in it.
      </ConfirmDialog>
    </section>
  );
}
