import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { callsTo, failure, jsonResponse, mockApi, newcomer, player } from './test/fakeApi.js';

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

const signedOut = () => failure(401, 'You need to sign in to continue');
const signedInAs = (user) => () => jsonResponse(200, { success: true, user });

const signInForm = async (identifier = 'rahim', password = 'Correct-Horse-42') => {
  await userEvent.type(await screen.findByLabelText('Username or email'), identifier);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('signing in', () => {
  it('sends a signed-out visitor to the sign-in screen', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderApp('/dashboard');

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(document.title).toBe('Sign in · Elo League');
  });

  it('treats an unreachable server as signed out rather than hanging', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderApp('/dashboard');

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('opens the dashboard after a successful sign-in', async () => {
    const api = mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': signedInAs(player),
    });
    renderApp('/');
    await signInForm('  rahim  ');

    expect(await screen.findByRole('heading', { name: 'Welcome back, Rahim' })).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/auth/login')[0].body).toEqual({
      identifier: 'rahim',
      password: 'Correct-Horse-42',
    });
  });

  it('shows the server message and stays put when the details are wrong', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': () => failure(401, 'Wrong username or password'),
    });
    renderApp('/login');
    await signInForm('rahim', 'wrong-password-1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows the throttling message from the server', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': () =>
        failure(429, 'Too many sign-in attempts. Try again in a few minutes.'),
    });
    renderApp('/login');
    await signInForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-in attempts');
  });

  it('keeps someone who is already signed in away from the sign-in screen', async () => {
    mockApi({ 'GET /api/auth/me': signedInAs(player) });
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Welcome back, Rahim' })).toBeInTheDocument();
  });
});

describe('temporary passwords', () => {
  it('sends a new account to set its own password straight after signing in', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': signedInAs(newcomer),
    });
    renderApp('/login');
    await signInForm('arman', 'Temp-Pass-1234');

    expect(
      await screen.findByRole('heading', { name: 'Set your own password' })
    ).toBeInTheDocument();
  });

  it('keeps that account out of every other screen', async () => {
    mockApi({ 'GET /api/auth/me': signedInAs(newcomer) });
    renderApp('/dashboard');

    expect(
      await screen.findByRole('heading', { name: 'Set your own password' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});

describe('changing the password', () => {
  const fillForm = async ({ current, next, confirm }) => {
    await userEvent.type(await screen.findByLabelText('Current password'), current);
    await userEvent.type(screen.getByLabelText('New password'), next);
    await userEvent.type(screen.getByLabelText('Repeat new password'), confirm);
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
  };

  const setup = (changeHandler) =>
    mockApi({
      'GET /api/auth/me': signedInAs(newcomer),
      'POST /api/auth/change-password': changeHandler,
    });

  it('explains each problem without calling the server', async () => {
    const api = setup(() => signedInAs(player)());
    renderApp('/change-password');
    await fillForm({ current: 'Temp-Pass-1234', next: 'short', confirm: 'different' });

    expect(await screen.findByText('Use at least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('The two passwords do not match')).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/auth/change-password')).toHaveLength(0);
  });

  it('refuses to reuse the current password', async () => {
    const api = setup(() => signedInAs(player)());
    renderApp('/change-password');
    await fillForm({
      current: 'Temp-Pass-1234',
      next: 'Temp-Pass-1234',
      confirm: 'Temp-Pass-1234',
    });

    expect(
      await screen.findByText('Choose a password different from your current one')
    ).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/auth/change-password')).toHaveLength(0);
  });

  it('changes the password and opens the dashboard', async () => {
    const api = setup(signedInAs({ ...newcomer, mustChangePassword: false }));
    renderApp('/change-password');
    await fillForm({
      current: 'Temp-Pass-1234',
      next: 'Brand-New-Pass-7',
      confirm: 'Brand-New-Pass-7',
    });

    expect(await screen.findByRole('heading', { name: 'Welcome back, Arman' })).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/auth/change-password')[0].body).toEqual({
      currentPassword: 'Temp-Pass-1234',
      newPassword: 'Brand-New-Pass-7',
    });
  });

  it('shows the server message when the current password is wrong', async () => {
    setup(() => failure(400, 'Your current password is not right'));
    renderApp('/change-password');
    await fillForm({
      current: 'Not-My-Password-1',
      next: 'Brand-New-Pass-7',
      confirm: 'Brand-New-Pass-7',
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your current password is not right'
    );
    expect(screen.getByRole('heading', { name: 'Set your own password' })).toBeInTheDocument();
  });

  it('returns to sign-in when the session has expired meanwhile', async () => {
    setup(() => failure(401, 'Your session expired. Sign in again.'));
    renderApp('/change-password');
    await fillForm({
      current: 'Temp-Pass-1234',
      next: 'Brand-New-Pass-7',
      confirm: 'Brand-New-Pass-7',
    });

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('signed-in screens', () => {
  const signedInApi = () =>
    mockApi({
      'GET /api/auth/me': signedInAs(player),
      'POST /api/auth/logout': () => jsonResponse(200, { success: true }),
    });

  it('shows the navigation, the player and a skip link', async () => {
    signedInApi();
    renderApp('/dashboard');

    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByText('1200 pts · user')).toBeInTheDocument();
  });

  it('signs out and returns to the sign-in screen', async () => {
    const api = signedInApi();
    renderApp('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(callsTo(api, 'POST /api/auth/logout')).toHaveLength(1);
  });

  it('still signs out on screen when the request fails', async () => {
    mockApi({
      'GET /api/auth/me': signedInAs(player),
      'POST /api/auth/logout': () => failure(500, 'Server error'),
    });
    renderApp('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('opens and closes the menu on small screens', async () => {
    signedInApi();
    renderApp('/dashboard');
    const toggle = await screen.findByRole('button', { name: 'Open menu' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(document.getElementById('mobile-menu')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(document.getElementById('mobile-menu')).not.toBeInTheDocument();
  });

  it('shows a helpful page for an address that does not exist', async () => {
    signedInApi();
    renderApp('/no/such/page');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });
});
