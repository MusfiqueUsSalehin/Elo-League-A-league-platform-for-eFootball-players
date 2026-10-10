import { Link } from 'react-router';
import { Button } from '../components/ui/index.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';

export default function NotFound() {
  usePageTitle('Page not found');

  return (
    <div className="space-y-4 py-10 text-center">
      <p className="scoreline text-6xl text-flood">404</p>
      <h1 className="font-display text-3xl leading-none">Page not found</h1>
      <p className="text-sm text-mist">That page does not exist, or it has moved.</p>
      <Button as={Link} to="/dashboard">
        Back to the dashboard
      </Button>
    </div>
  );
}
