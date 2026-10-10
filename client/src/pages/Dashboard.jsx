import { StatTile } from '../components/ui/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';

export default function Dashboard() {
  usePageTitle('Dashboard');
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl leading-none">
          Welcome back, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-2 text-sm text-mist">
          Your fixtures, form and stats will appear here as the league gets going.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Rating" value={user.elo} tone="gold" />
        <StatTile label="Peak rating" value={user.peakElo} />
        <StatTile label="Platform" value={user.platform} />
      </div>
    </div>
  );
}
