# Elo League server

Express and MongoDB API.

## Requirements

- Node.js 20 or newer
- A MongoDB instance (Atlas free tier or a local install)

## Setup

    cd server
    npm install
    Copy-Item .env.example .env    # then edit MONGO_URI, JWT_SECRET and ADMIN_PASSWORD
    npm run seed:admin             # creates the first admin
    npm run dev

## Scripts

| Script             | What it does                               |
| ------------------ | ------------------------------------------ |
| `npm run dev`      | Start with auto-restart on file changes    |
| `npm start`        | Start for production                       |
| `npm test`         | Run the tests (uses an in-memory MongoDB)  |
| npm run seed:admin | Create the first admin (safe to run again) |

## Environment variables

Validated at boot. A bad value stops the server with a message listing every problem.

| Variable                                      | Default                                    | Notes                                  |
| --------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `NODE_ENV`                                    | `development`                              | `development`, `test` or `production`  |
| `PORT`                                        | `5000`                                     |                                        |
| `APP_NAME`                                    | `Elo League`                               |                                        |
| `CLIENT_URL`                                  | `http://localhost:5173`                    | Allowed CORS origin                    |
| `TIMEZONE`                                    | `Asia/Dhaka`                               |                                        |
| `MONGO_URI`                                   | local `elo_league` database                | Required when `NODE_ENV=production`    |
| `LOG_LEVEL`                                   | `info`                                     | `silent` turns logging off             |
| `JWT_SECRET`                                  | development-only value                     | Required in production, 32+ characters |
| `JWT_EXPIRES_DAYS`                            | `7`                                        | Session lifetime                       |
| `BCRYPT_ROUNDS`                               | `12`                                       | At least 10 in production              |
| `LOGIN_RATE_LIMIT_MAX`                        | `20`                                       | Failed sign-ins per IP per 10 minutes  |
| `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL` | League Admin, admin, admin@eloleague.local | First admin details                    |
| `ADMIN_PASSWORD`                              | none                                       | Required to run `seed:admin`           |

Real environment variables override values in `server/.env`.

## Endpoints

| Endpoint          | Purpose                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `GET /api/health` | Liveness. 200 while the process is running.                                |
| `GET /api/ready`  | Readiness. 200 when MongoDB answers, 503 otherwise or while shutting down. |

## Logging and errors

- Logs are JSON in production and pretty-printed in development.
- Every response carries an `X-Request-Id` header. A well-formed id sent by the caller is reused.
- Errors return `{ success: false, message, details?, requestId }`. Stack traces and internal messages are never sent in production.
- `Authorization` and cookie headers are redacted from logs.

## Shutdown

`SIGTERM` and `SIGINT` stop new connections, finish in-flight requests, close MongoDB and exit. Readiness reports 503 first so a load balancer stops sending traffic.

## Authentication

- Accounts are created by an admin. There is no public sign-up.
- Sign-in sets an httpOnly, SameSite=Lax session cookie (`elo_token`, `Secure` in production).
  Tokens are never exposed to page JavaScript.
- A new or reset account has a temporary password. Until it is changed, every endpoint except
  `/api/auth/*` answers `403` with `code: "PASSWORD_CHANGE_REQUIRED"`.
- Changing or resetting a password, or deactivating an account, signs out every other session.
- Passwords: at least 10 characters, with a letter and a number (72 bytes at most).
- Failed sign-ins are limited per IP. Wrong-username and wrong-password answers are identical.

## Account endpoints

| Endpoint                             | Who         | Purpose                                                  |
| ------------------------------------ | ----------- | -------------------------------------------------------- |
| `POST /api/auth/login`               | anyone      | Sign in                                                  |
| `POST /api/auth/logout`              | anyone      | Clear the session cookie                                 |
| `GET /api/auth/me`                   | signed in   | Current user                                             |
| `POST /api/auth/change-password`     | signed in   | Replace your password                                    |
| `PATCH /api/users/profile`           | signed in   | Edit your name, Konami ID, platform, phone               |
| `GET /api/users/:id`                 | self, admin | Read an account                                          |
| `GET /api/users`                     | admin       | List and search (`q`, `role`, `status`, `page`, `limit`) |
| `POST /api/users`                    | admin       | Create an account, returns a one-time temporary password |
| `PATCH /api/users/:id`               | admin       | Edit, change role, activate or deactivate                |
| `POST /api/users/:id/reset-password` | admin       | Issue a new temporary password                           |

Admins cannot deactivate, demote or reset themselves, so the league always has an active admin.
Accounts are deactivated, never deleted, to keep match history intact.

## Teams and squads

Every signed-in player can look at any team. Only a team's owner (or an admin) can change it.
A player can own at most 5 teams, and a squad holds at most 40 players.

| Endpoint                                | Who            | Purpose                                                    |
| --------------------------------------- | -------------- | ---------------------------------------------------------- |
| `GET /api/teams`                        | signed in      | List teams (`q`, `mine=true`, `owner`, `page`, `limit`)    |
| `POST /api/teams`                       | signed in      | Create a team. Admins can pass `ownerId` for someone else. |
| `GET /api/teams/:id`                    | signed in      | A team with its squad, best rated first                    |
| `PATCH /api/teams/:id`                  | owner or admin | Rename a team or change its formation                      |
| `DELETE /api/teams/:id`                 | owner or admin | Delete a team and its squad                                |
| `PUT /api/teams/:id/lineup`             | owner or admin | Save the formation and starting XI (replaces the old one)  |
| `POST /api/teams/:id/squad`             | owner or admin | Add a squad player (`name`, `position`, `rating`)          |
| `PATCH /api/teams/:id/squad/:playerId`  | owner or admin | Edit a squad player                                        |
| `DELETE /api/teams/:id/squad/:playerId` | owner or admin | Remove a squad player (and from the line-up)               |
| `POST /api/teams/:id/squad/import`      | owner or admin | Paste a squad list, one `Name, Position, Rating` per line  |

Notes:

- Team names are unique per owner, ignoring letter case. Squad player names are unique per team.
- Positions: GK, CB, LB, RB, DMF, CMF, AMF, LMF, RMF, LWF, RWF, SS, CF. Ratings are whole
  numbers from 1 to 120.
- A line-up is a list of `{ slot, footballer }` where slot 0 is the goalkeeper. It can be saved
  part-filled while the manager is still choosing.
- The paste import never fails on a bad line: good lines are added, and the rest come back in
  `skipped` with their line number and the reason.
- Requests cannot set `owner`, `lineup` or any other field that is not listed above.
