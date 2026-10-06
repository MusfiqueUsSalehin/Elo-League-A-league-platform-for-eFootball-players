# Contributing

## Setup

Requires Node.js 20 or newer.

    npm ci

Husky installs the Git hooks automatically on `npm ci`.

## Workflow

1. Branch from `master`: `git switch -c feature/<name>`.
2. Build one logical change with incremental commits.
3. Push the branch and open a pull request into `master`.
4. When CI is green, merge with a merge commit (never squash).

`pre-release` and `release/*` branches are described in the README.

## Commit messages

Format: `type(scope): imperative summary`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`.

A scope is required. One commit is one understandable logical change.
The `commit-msg` hook and CI both reject anything else.

## Checks

    npm run lint
    npm run format:check

The `pre-commit` hook formats and lints staged files automatically.
