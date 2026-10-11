import { Link } from 'react-router';
import { Button } from '../components/ui/index.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';

export default function Forbidden() {
  usePageTitle('Admins only');

  return (
    <div className="space-y-4 py-10 text-center">
      <p className="scoreline text-6xl text-flood">403</p>
      <h1 className="font-display text-3xl leading-none">Admins only</h1>
      <p className="text-sm text-mist">Your account does not have access to this page.</p>
      <Button as={Link} to="/dashboard">
        Back to the dashboard
      </Button>
    </div>
  );
}
