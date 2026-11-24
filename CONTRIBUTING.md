# Contributing to Eauxle

Thank you for your interest. Bug reports, small fixes and translation corrections are welcome as pull requests. For a new feature or a larger change, open an issue first so the approach can be agreed before you write code.

Security problems are not reported through issues: see [docs/SECURITY.md](./docs/SECURITY.md).

## Setup

Follow [Getting started](./README.md#getting-started) in the README. The project uses pnpm only (the version in `packageManager` in `package.json`); run tools from dependencies with `pnpm exec`, not `npx`. Node.js must meet `engines.node` in `package.json`; `pnpm install` refuses an older version.

Installing the dependencies also installs the git hooks: `pre-commit` lints and formats the staged files, and `commit-msg` checks the commit message.

## Before you open a pull request

Run the same checks as CI:

```bash
pnpm typecheck && pnpm lint:strict && pnpm format:check && pnpm exec knip && pnpm test:coverage
```

For a change to the Python scripts (`scripts/`, `tests/python`), with [uv](https://docs.astral.sh/uv/):

```bash
uv sync --locked && uv run ruff check . && uv run ruff format --check . && uv run pytest tests/python -q
```

For a change to the interface, also run the end-to-end tests in one browser (the first command downloads the browser once):

```bash
pnpm exec playwright install chromium
pnpm test:e2e --project=chromium
```

Conventions that review looks for beyond what the linters enforce:

- Every text shown to players goes through next-intl and is added to both `messages/en.json` and `messages/pl.json`.
- Interfaces stay usable with a keyboard and a screen reader, with WCAG AA contrast. Sizes and spacing use `rem`, colours come from the design tokens in `app/globals.css`.
- Database changes are made only through new files in `supabase/migrations/`, never in the Supabase dashboard.
- New logic comes with tests.

## Commits and pull requests

Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, for example `fix(game): keep the skip dialog open after a network error`. The subject is in the imperative mood, lowercase, without a final period and at most 72 characters long. Pull requests are merged with squash, so the pull request title becomes the commit on `main`.

A pull request that changes what is deployed (the app, its messages, public files, the lockfile) also moves the version in `package.json` by the step its title names: `feat` the middle number, any other type the last one, `!` the first (the middle one before 1.0). After you open it, or when its title or base changes, run `pnpm version:bump "<title>"` and commit the result; CI fails with that instruction otherwise. The command also adds the version to `lib/changelog.json`. A `feat` needs notes for the players there, in English and Polish; other changes may keep an empty list, which keeps them out of the player-facing list. After renaming a pull request, run `pnpm version:bump "<new title>"` again and rerun the "Quality checks" job: a rename starts no run by itself, so CI keeps the result for the old title. A pull request that reverts another must be titled `revert: ...`, because the title GitHub proposes (`Revert "..."`) is not a Conventional Commit and the check refuses it. The release for a version is created after production serves it.

Keep a pull request to one topic. Fill in the template: what changed, which checks you ran and which you skipped, with the reason.

## Review

Every pull request runs the CI checks, which must pass before a merge. The maintainer may request a CodeRabbit review on a pull request; its comments are suggestions, and the maintainer decides which of them apply. The maintainer reviews the change and merges it.

## License

By contributing, you agree that your contribution is licensed under the [Apache License 2.0](./LICENSE), the license of this project.
