# Elo League client

React single-page app for Elo League. It talks to the server in `../server` through `/api`.

## Run it

From the repository root:

    npm run install:all      # first time only
    npm run dev              # server on :5000, client on :5173

Or the client alone: `cd client`, then `npm run dev`. Open http://localhost:5173.

The dev server proxies `/api` to `http://localhost:5000`, so the browser sees a single
origin and the session cookie behaves exactly as it does in production.

## Scripts

| Script               | What it does                         |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start the dev server with hot reload |
| `npm run build`      | Production build into `dist/`        |
| `npm run preview`    | Serve the production build locally   |
| `npm test`           | Run the tests once                   |
| `npm run test:watch` | Re-run tests as files change         |

## Structure

    src/
      api/           fetch wrapper and the ApiError it throws
      components/    shared pieces
        ui/          buttons, fields, alerts and other base components
        layout/      the app shell and the pre-sign-in layout
      context/       AuthContext: who is signed in
      hooks/         small reusable hooks
      lib/           plain helpers with no React in them
      pages/         one file per screen, each loaded on demand
      test/          test setup and a fake API for tests

## How sign-in works

- The session is an httpOnly cookie set by the server. The app never sees or stores a token.
- On load the app asks `GET /api/auth/me`. The answer decides whether you are signed in.
- A temporary password sets `mustChangePassword`. Until it is changed, route guards allow only
  the change-password screen, and the server refuses everything else with
  `PASSWORD_CHANGE_REQUIRED`.
- Any `401` from the server signs the user out on screen.

## Conventions

- Screens are lazy-loaded in `App.jsx`.
- Form fields use `TextField`, which wires labels, hints and errors for screen readers.
- Tests use Testing Library and a fake `fetch` (`src/test/fakeApi.js`). An unexpected request
  fails the test.
- Fonts are bundled, so the app makes no third-party requests.

## Admin screens

Admins get a **Players** link in the navigation. `/admin/players` lists accounts with search,
role and status filters and pagination, and lets an admin add players, edit them, deactivate
or reactivate them and reset passwords.

- A temporary password is shown once, in a dialog, and is never stored in readable form.
- Admins cannot deactivate, demote or reset themselves. The buttons are disabled and the
  server enforces the same rule.
- Accounts are deactivated, never deleted, so match history stays intact.
- Players who open an admin address see a 403 page; the server rejects the requests anyway.

## Dialogs

`Modal` (in `components/ui`) is built on the native `<dialog>` element, so the browser traps
focus, makes the page behind it inert, closes on Escape and restores focus. Its content is
mounted only while open, so forms inside always start empty. Use `ConfirmDialog` for
yes/no questions with consequences.

## Teams

- `/teams` lists teams as cards: "My teams" or "All teams", with search and pagination.
- `/teams/:id` is the team page. Anyone can look; only the manager (or an admin) sees the
  buttons to edit the team, add, edit or remove squad players, and paste a squad list.
- `/teams/:id/lineup` shows the formation on a pitch. Select a spot to pick who plays there;
  the natural position is listed first. Changes are kept in the page until "Save line-up".
- Pasting a squad takes one player per line: name, position, rating. Bad lines are skipped and
  reported with their line number.
- Formation layouts live in `src/lib/formations.js` and must match the list on the server.

## Notifications

- The sidebar shows a count of unread notifications. It refreshes every minute while the tab
  is visible, and when you come back to the tab.
- `/notifications` lists them, newest first, with "All" and "Unread only". Selecting one marks
  it read and opens its link, if it has one. "Mark all as read" clears the count.
- The Email switches on the same page choose which kinds of notification also arrive by
  email. Each switch saves straight away and flips back if the server refuses.
- The list of kinds lives in `src/lib/notifications.js` and must match the server.

## Competitions

- `/tournaments` lists leagues and cups with search and filters. Admins also see drafts and a
  "New competition" button.
- `/tournaments/:id` shows how a competition is played, who has entered, and what is happening.
  Managers can enter one of their teams while entries are open, and withdraw it again. Admins
  can edit, open entries, approve or turn down teams, remove a team, cancel, and delete a draft.
- Fixtures and tables are added in the next step.
