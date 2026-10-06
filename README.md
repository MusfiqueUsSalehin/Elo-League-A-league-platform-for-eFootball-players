# Elo League

A league platform for eFootball players.

Elo League is a private competition platform for a circle of friends. An admin creates
the accounts and runs the competitions. Every player gets their own panel with their squad,
fixtures, form and stats, and a rating that moves with every confirmed result.

> **Status:** in development. Features are listed below as they are built.

## Planned scope

- Admin-issued accounts with forced password change on first login
- Teams, squads, formations and a starting XI picker
- Leagues (single or double round-robin) and knockout cups with byes
- Two-sided result confirmation: one player submits, the opponent confirms
- Elo-style rating with tiers (Rookie to Legend)
- Player stats, form guides, head-to-head records and leaderboards
- In-app and email notifications with match reminders
- An optional AI coach for formation and line-up suggestions

## Tech stack

Node.js, Express and MongoDB on the server. React, Vite and Tailwind CSS on the client.

## Branching model

| Branch           | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `master`         | Integration branch. Every merge here leaves the app in a working state.        |
| `feature/*`      | One logical change per branch, built with incremental commits.                 |
| `pre-release`    | Cut once the MVP is integrated. Integration fixes, docs and deployment checks. |
| `release/v1.0.0` | Cut from `pre-release`. The version that is deployed and demonstrated.         |

Feature branches are merged with `--no-ff` so the history keeps the shape of the work.

## Commit convention

Format: `type(scope): imperative summary`

Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`.

One commit is one understandable logical change.

---

Elo League is an independent project and is not affiliated with or endorsed by Konami.
eFootball is a trademark of Konami Digital Entertainment.
