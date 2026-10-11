import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { FullPageSpinner } from './ui/index.jsx';

const CHANGE_PASSWORD_PATH = '/change-password';

/**
 * Wraps every screen that needs a signed-in user. Someone still on a temporary password
 * can only reach the change-password screen, matching what the server enforces.
 */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }
  return <Outlet />;
}

/** For the sign-in screen: someone who is already signed in has no business there. */
export function GuestOnly() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (user) return <Navigate to={location.state?.from?.pathname ?? '/dashboard'} replace />;
  return <Outlet />;
}
