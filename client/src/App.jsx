import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import AppShell from './components/layout/AppShell.jsx';
import { GuestOnly, RequireAuth } from './components/RouteGuards.jsx';
import { FullPageSpinner } from './components/ui/index.jsx';

// Each screen is its own chunk, so people only download what they open.
const Login = lazy(() => import('./pages/Login.jsx'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
