import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { Avatar, cx } from '../ui/index.jsx';

// Each feature adds its own entry here as it ships.
const NAV_ITEMS = [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }];

const linkClass = ({ isActive }) =>
  cx(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
    isActive ? 'bg-turf-700 text-chalk' : 'text-mist hover:bg-turf-800 hover:text-chalk'
  );

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-flood font-display text-lg text-turf-900"
      >
        EL
      </span>
      <div className="leading-tight">
        <p className="font-display text-lg">Elo League</p>
        <p className="text-xs text-mist">Matchday HQ</p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />

      <nav aria-label="Main" className="space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass} onClick={onNavigate}>
            <Icon size={17} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-line pt-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-turf-800 px-3 py-2">
          <Avatar name={user.name} size={32} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm">{user.name}</p>
            <p className="text-xs text-mist">
              {user.elo} pts · {user.role}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-mist transition-colors hover:bg-turf-800 hover:text-loss"
        >
          <LogOut size={17} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Page frame for signed-in screens: sidebar on large screens, a collapsible menu on small ones. */
export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-flood focus:px-4 focus:py-2 focus:text-turf-900"
      >
        Skip to content
      </a>

      <aside className="hidden w-64 shrink-0 border-r border-line bg-turf-900/80 lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-turf-900/95 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="rounded-lg border border-line p-2"
            >
              {menuOpen ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <Menu size={18} aria-hidden="true" />
              )}
            </button>
            <span className="font-display text-lg">Elo League</span>
          </div>
          {menuOpen && (
            <div id="mobile-menu" className="border-t border-line">
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
            </div>
          )}
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
