import { Link } from 'react-router';
import {
  kickoffLabel,
  MATCH_STATUS_LABELS,
  MATCH_STATUS_TONES,
  scoreLabel,
  teamName,
} from '../../lib/matches.js';
import { Badge } from '../ui/index.jsx';

export default function MatchRow({ match, showTournament = false }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-3 first:border-t-0">
      <div className="w-44 text-xs text-mist">
        <p>{kickoffLabel(match.scheduledAt)}</p>
        {showTournament && match.tournament && (
          <Link to={`/tournaments/${match.tournament._id}`} className="hover:underline">
            {match.tournament.name}
          </Link>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-3 text-sm">
        <span className="flex-1 text-right font-medium">{teamName(match.homeTeam)}</span>
        <span className="scoreline min-w-12 text-center text-lg">{scoreLabel(match)}</span>
        <span className="flex-1 font-medium">{teamName(match.awayTeam)}</span>
      </div>
      <Badge tone={MATCH_STATUS_TONES[match.status]}>{MATCH_STATUS_LABELS[match.status]}</Badge>
    </li>
  );
}
