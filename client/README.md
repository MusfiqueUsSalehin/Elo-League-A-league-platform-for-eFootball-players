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
