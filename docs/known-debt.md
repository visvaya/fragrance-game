# Known technical debt

Deliberate shortcuts that are safe for now but should be paid off. Each entry says where the shortcut lives and what "done" means. Remove an entry when it is resolved.

## E2E suite does not pass

- **Where:** `e2e/**`, `.github/workflows/e2e-nightly.yml`.
- **Shortcut:** the suite never ran in CI between March and September 2026 (a module-format error aborted every run). Once it ran again, 15 of 102 chromium tests failed and 4 were flaky. The full suite (about 18 minutes, mostly retries of known failures) therefore runs nightly and on demand with `continue-on-error`; pull requests run only the two blocking smoke tests ("Playwright Smoke").
- **Causes seen in the first run (2026-09-27):**
  - Stale expectations: `getByLabel(/help/i)` and `/pomoc/i`, `getByTestId("loader-icon")`, the "No results" text, disabled state of already guessed options.
  - Shared test users: after the defeat flow finishes today's game, later specs using the same user no longer find the guess input (`xss-injection`, `game-completion`, `locale-switching`).
  - Auth and session specs (`auth.spec.ts` login/logout, `daily-reset.spec.ts` session persistence) no longer match the lazy session creation flow.
- **Risk:** regressions in user flows are not caught automatically.
- **Done when:** the nightly chromium suite passes twice in a row, `continue-on-error` is removed, and the suite is either fast enough for pull requests again or kept nightly as a deliberate choice. Start with test isolation (one fresh user per spec file or a reset between specs), then selectors.

## E2E synchronisation uses fixed waits

- **Where:** `e2e/**` (about 30 `page.waitForTimeout()` calls and 4 `waitForLoadState("networkidle")`), mostly `e2e/errors/error-handling.spec.ts` and `e2e/security/xss-injection.spec.ts`.
- **Shortcut:** `sonarjs/no-fixed-wait-in-tests` and `sonarjs/no-networkidle-wait` are off for e2e files in `eslint.config.mjs` (section 33). Both rules arrived with the eslint-plugin-sonarjs 4 upgrade.
- **Risk:** slow and flaky E2E runs, especially on a loaded machine.
- **Done when:** the waits are replaced with web-first assertions (`await expect(locator).toBeVisible()`, `page.waitForResponse(...)`) and both rules are removed from the e2e override.

## next-intl `requestLocale` is deprecated

- **Where:** `i18n/request.ts` (lint suppressed on the `getRequestConfig` line).
- **Shortcut:** next-intl 4.9+ deprecates `requestLocale` in favour of `next/root-params`.
- **Risk:** breaks on a future next-intl major.
- **Done when:** the request config reads the locale through `next/root-params` ([migration guide](https://next-intl.dev/blog/nextjs-root-params)) and the suppression is gone.

## Load-test tool runs outside the lockfile

- **Where:** `package.json` (`test:load` runs `pnpm dlx artillery@2.0.34`).
- **Shortcut:** artillery 2.0.34 depends on `csv-parse@4`, whose advisory (GHSA-8cw4-87c7-c6xx) is fixed only in 7, which changes the API artillery calls. Artillery is pinned, but its transitive dependencies are not locked and `pnpm audit` does not see them. `scripts/load-test.yaml` uses no CSV payload.
- **Risk:** a manual load-test run can pull a different or vulnerable transitive version; nothing in CI depends on it.
- **Done when:** an artillery release moves to `csv-parse` 5 or later (or the load test moves to another tool), and the tool returns to `devDependencies`.

## pnpm settings are duplicated for Vercel

- **Where:** `package.json` (`"pnpm"` field) and `pnpm-workspace.yaml` (`overrides`, `peerDependencyRules`, `allowBuilds`, `onlyBuiltDependencies`).
- **Shortcut:** local development and CI run pnpm 11 (pinned by `packageManager`), which reads only `pnpm-workspace.yaml`. Vercel picks pnpm 9 or 10 from `lockfileVersion` unless Corepack is enabled, and pnpm 9 reads only the `package.json` field. Both copies must stay identical.
- **Risk:** an override added in one place only silently disappears in the other environment.
- **Done when:** the Vercel project has `ENABLE_EXPERIMENTAL_COREPACK=1` (so Vercel also uses pnpm 11), then the `"pnpm"` field and `onlyBuiltDependencies` are removed.

## Client roles keep an unused grant on `daily_challenges_public`

- **Where:** production database grants; `supabase/tests/01_schema.test.sql` and `02_rls.test.sql` assert the grant exists.
- **State:** the view is `security_invoker` and `anon`/`authenticated` have no SELECT on `daily_challenges`, so the view grant is inert: client reads fail with `42501`, and server actions read the view through the service-role client. No browser code reads the view.
- **Risk:** low. If someone later restores table access for client roles, the view becomes readable again without a deliberate decision.
- **Done when (optional hardening):** a migration revokes SELECT on `daily_challenges_public` (and `perfumes_public`, if also unused by clients) from `anon` and `authenticated`, and the pgTAP assertions are updated.

## No staging database for the challenge algorithm tests

- **Where:** `app/api/cron/generate-daily/__tests__/algorithm.integration.test.ts`, `.github/workflows/integration-tests.yml`.
- **Shortcut:** the suite truncates tables, so it may only run against a staging project, and none exists (no `TEST_SUPABASE_URL` / `TEST_SUPABASE_SERVICE_ROLE_KEY` secrets). It is not run in CI; the nightly workflow runs only the read-only RLS tests.
- **Risk:** changes to daily challenge generation are verified only by unit tests with mocks.
- **Done when:** a staging Supabase project (or Supabase branch) exists, its credentials are stored as the two secrets, and the nightly workflow runs the suite against it.

## Coverage thresholds below the target

- **Where:** `vitest.config.ts` (`coverage.thresholds`).
- **Shortcut:** thresholds sit at the current level so CI stays green; the target is lines 80, functions 75, branches 70.
- **Done when:** thresholds reach the target. Raise them whenever coverage grows; never lower them.

## Sentry example page ships to production

- **Where:** `app/sentry-example-page/` (route `/sentry-example-page`).
- **Shortcut:** leftover from the Sentry setup wizard.
- **Done when:** the page is deleted and error reporting is confirmed through a real error.

## Migrations do not reproduce the production schema

- **Where:** `supabase/migrations/` versus the production database (checked 2026-10-01).
- **Shortcut:** several objects were created by hand and exist only in production: the functions `handle_new_user`, `auto_create_player`, `delete_auth_session` and `refresh_autocomplete_cache`, the triggers on `auth.users` and `auth.sessions`, the `user_sessions` table, several RLS policies, and view columns that differ from the migration definitions. `perfume_asset_sources` has two conflicting `IF NOT EXISTS` definitions, and the `eligible_perfumes` view exists only in migrations.
- **Risk:** a fresh database (staging, local, a future self-hosted server) does not match production; pgTAP in CI runs against production only.
- **Done when:** `supabase db diff` against production is empty and a database rebuilt from migrations passes `pnpm test:db`.

## Image pipeline lives outside version control

- **Where:** `img/bottles/` (git-ignored): `scripts/process_game_assets.py`, `generate_asset_list.py`, `preprocess_assets.py`, the prompt and the readme.
- **Shortcut:** the scripts that produce and upload every game image exist on one machine only; the readme describes old directory names and thresholds, and `scripts/requirements.txt` does not list Pillow or the AVIF plugin.
- **Risk:** losing the machine loses the pipeline; changes cannot be reviewed.
- **Done when:** the scripts and prompt are tracked under `scripts/assets/` (photos stay outside the repository), with dependencies listed and a secret scan passed.

## `asset_random_id` is not unique

- **Where:** `supabase/migrations/20260120100000_perfume_assets.sql` (plain index only).
- **Done when:** a `UNIQUE` constraint replaces the index.

## Daily puzzle cron is unbounded and reads live difficulty

- **Where:** `app/api/cron/generate-daily/route.ts`.
- **Shortcut:** the candidate query has no `.limit()` or paging, it does not skip perfumes with `is_active = false` or without `xsolve_score` (a missing score later breaks `getDailyChallenge`), and `snapshot_metadata` is stored empty, so the score multiplier is read live and a new ETL import changes the scoring of past puzzles.
- **Done when:** candidates are filtered and paged, and the puzzle stores the xSolve value it was published with.

## Hardcoded fallback for the assets host

- **Where:** `app/actions/game-actions.ts` (`NEXT_PUBLIC_ASSETS_HOST ?? "assets.eauxle.com"`, two places).
- **Done when:** the variable is required in `lib/env.ts` and the fallback is gone.

## Unbounded session list

- **Where:** `app/actions/auth-actions.ts`, `getSessions` (query on `user_sessions` without `.limit()`).
- **Done when:** the query has a limit, as the project rules require for every `select()`.

## Account merge is not transactional

- **Where:** `app/actions/auth-actions.ts`, `migrateAnonymousPlayer` (separate deletes and updates through the service role).
- **Risk:** a failure halfway leaves a player's history split between two accounts.
- **Done when:** the merge runs in one database function inside a transaction.

## ETL does not record import runs

- **Where:** `scripts/etl_v5.py`.
- **Shortcut:** the `import_runs` and `import_conflicts` tables are never written; duplicates are dropped keep-first instead of merged.
- **Done when:** each import writes a run record and its conflicts.

## Client IP taken from `x-forwarded-for`

- **Where:** `proxy.ts` and `app/actions/autocomplete.ts` (per-IP rate limits).
- **Shortcut:** the first value of the header is trusted. Vercel sets the header itself, so this is safe there; behind a self-hosted reverse proxy that appends to the header, clients could choose their own IP and bypass per-IP limits.
- **Done when:** before moving off Vercel, the IP is taken from the hop added by the trusted proxy.

## Local and production migration histories are disjoint

- **Where:** `supabase/migrations/` versus `supabase_migrations.schema_migrations` in production.
- **Shortcut:** production migrations were applied through the dashboard or the Supabase MCP server, which records its own timestamps, so `supabase migration list` shows two unrelated version sequences. `supabase db push` would try to re-apply every local migration.
- **Risk:** the standard deploy command cannot be used; a migration is applied by hand, one file at a time.
- **Done when:** the remote history is repaired (`supabase migration repair`) after the schema drift above is resolved, and `supabase db push` reports nothing to apply.

## Dead and duplicated reveal data

- **Where:** `lib/game/scoring.ts` (`yearMask` templates, correct only for years starting with 1 and read only by tests) and `components/game/contexts/game-state-context.tsx` (letter reveal percentages repeated instead of read from `getRevealPercentages()`).
- **Done when:** one reveal table drives both server and client, and unused fields are gone.

## Loose validation and limits in auth actions

- **Where:** `app/actions/auth-actions.ts`, `getAnonSessionAttemptCount` (ids validated as plain strings, not UUIDs); `app/actions/security-actions.ts`, `validatePasswordSafety` (no rate limit).
- **Done when:** both ids use `z.uuid()` and the password check has a per-IP limit in `lib/redis.ts`.

## No privacy policy or consent choice

- **Where:** `components/game/game-footer.tsx` (the privacy policy, terms and contact links only show a "coming soon" toast); `components/providers/posthog-provider.tsx` and `instrumentation-client.ts` (analytics and error reporting start without asking).
- **Shortcut:** there is no privacy policy or terms page and no dialog to accept or refuse optional cookies. PostHog loads on the first interaction or after 15 seconds and keeps its identifier in a cookie and `localStorage` (default persistence); Sentry reports errors for every visitor.
- **Risk:** processing personal data without the information and consent that GDPR and the ePrivacy rules require for players in the EU.
- **Done when:** the footer links open real privacy policy, terms and contact pages (both locales; the policy needs a contact point anyway), and a consent dialog with equally prominent accept and reject options gates optional analytics, with the choice stored and changeable later.
