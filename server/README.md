# Elo League server

Express and MongoDB API.

## Requirements

- Node.js 20 or newer
- A MongoDB instance (Atlas free tier or a local install)

## Setup

    cd server
    npm install
    Copy-Item .env.example .env    # then edit MONGO_URI
    npm run dev

## Scripts

| Script        | What it does                              |
| ------------- | ----------------------------------------- |
| `npm run dev` | Start with auto-restart on file changes   |
| `npm start`   | Start for production                      |
| `npm test`    | Run the tests (uses an in-memory MongoDB) |

## Environment variables

Validated at boot. A bad value stops the server with a message listing every problem.

| Variable     | Default                     | Notes                                 |
| ------------ | --------------------------- | ------------------------------------- |
| `NODE_ENV`   | `development`               | `development`, `test` or `production` |
| `PORT`       | `5000`                      |                                       |
| `APP_NAME`   | `Elo League`                |                                       |
| `CLIENT_URL` | `http://localhost:5173`     | Allowed CORS origin                   |
| `TIMEZONE`   | `Asia/Dhaka`                |                                       |
| `MONGO_URI`  | local `elo_league` database | Required when `NODE_ENV=production`   |
| `LOG_LEVEL`  | `info`                      | `silent` turns logging off            |

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
