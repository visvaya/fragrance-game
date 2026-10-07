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

## Ignored audit advisory for `braces`

- **Where:** `pnpm-workspace.yaml` (`auditConfig.ignoreGhsas`).
- **Shortcut:** GHSA-vfj7-8cjw-p6xm (`braces` <= 3.0.3, denial of service through deeply nested brace patterns) has no patched release, so `pnpm audit` ignores it to keep the required Dependency Audit check usable. `braces` is reached only through development tools (ESLint, depcheck, ts-morph) that expand patterns from this repository's own configuration; `pnpm audit --prod` reports nothing. A step in `security-scan.yml` fails if `braces` becomes a production dependency while the ignore is in place.
- **Risk:** a development tool could hang on a crafted pattern; no user input reaches it, and production builds do not ship it.
- **Done when:** `braces` 3.0.4 or later is released, the lockfile picks it up, and the ignore entry is removed.

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
- **Shortcut:** several objects were created by hand and exist only in production: the functions `handle_new_user`, `auto_create_player`, `delete_auth_session` and `refresh_autocomplete_cache`, the triggers on `auth.users` and `auth.sessions`, the `user_sessions` table, the RLS policies on `user_sessions`, and view columns that differ from the migration definitions. `perfume_asset_sources` has two conflicting `IF NOT EXISTS` definitions, and the `eligible_perfumes` view exists only in migrations. The local development stack now runs the same PostgreSQL major version as production (17).
- **Risk:** a fresh database (staging, local, a future self-hosted server) does not match production; pgTAP in CI runs against production only.
- **Done when:** `supabase db diff` against production is empty and a database rebuilt from migrations passes `pnpm test:db`.

## Illustration prompt lives outside version control

- **Where:** the prompt for the manual illustration step, kept outside the repository on one machine (the scripts are tracked in `scripts/assets/`).
- **Shortcut:** the prompt is not stored in any backed-up place.
- **Risk:** losing the machine loses the prompt, so new illustrations no longer match the existing style.
- **Done when:** the prompt is stored in a backed-up place.

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

- **Where:** `lib/game/scoring.ts` (`yearMask` templates, correct only for years starting with 1 and read only by tests) and `lib/game/clue-reveal.ts` (letter reveal fractions repeated instead of read from `getRevealPercentages()`).
- **Done when:** one reveal table drives the clue masking and the score data, and unused fields are gone.

## No rate limit on the password safety check

- **Where:** `app/actions/security-actions.ts`, `validatePasswordSafety` (no rate limit).
- **Done when:** the password check has a per-IP limit in `lib/redis.ts`.

## No privacy policy or consent choice

- **Where:** `components/game/game-footer.tsx` (the privacy policy, terms and contact links only show a "coming soon" toast); `components/providers/posthog-provider.tsx` and `instrumentation-client.ts` (analytics and error reporting start without asking).
- **Shortcut:** there is no privacy policy or terms page and no dialog to accept or refuse optional cookies. PostHog loads on the first interaction or after 15 seconds and keeps its identifier in a cookie and `localStorage` (default persistence); Sentry reports errors for every visitor.
- **Risk:** processing personal data without the information and consent that GDPR and the ePrivacy rules require for players in the EU.
- **Done when:** the footer links open real privacy policy, terms and contact pages (both locales; the policy needs a contact point anyway), and a consent dialog with equally prominent accept and reject options gates optional analytics, with the choice stored and changeable later.

## `game-provider` tests time out under load

- **Where:** `components/game/__tests__/game-provider.test.tsx`.
- **Shortcut:** in full `pnpm test:coverage` runs on a loaded machine, one test from this file regularly exceeds the 5 s default timeout (a different test each time; seen in at least five runs on 2026-10-01 and 2026-10-02). The file passes on its own every time and in CI, so the failures are treated as load noise and the file is re-run alone.
- **Risk:** a real regression in this file can be dismissed as noise, and full local runs need a second pass.
- **Done when:** the file passes reliably in full runs, for example by finding what makes it slow (rendering the whole provider tree, real timers in `waitFor`) and fixing that, or by a justified per-file timeout.

## Stats and profile dialogs show sample numbers

- **Where:** `components/game/modals/stats-modal.tsx` (`STATS` constant), `components/profile/profile-modal.tsx` (played, won and streak cells).
- **Shortcut:** both dialogs render fixed sample values (12 played, 83% won, streak 4, best 9; distribution `[0, 2, 6, 3, 1]`). The distribution has five rows although a game has six attempts, and there is no row for lost games.
- **Risk:** every player, including a first-time guest, sees statistics that are not theirs.
- **Done when:** both dialogs read the player's own games (six attempt rows plus losses, today's result highlighted), and a player with no games sees an empty state instead of numbers.

## Auth error toast uses missing translation keys

- **Where:** `components/auth/auth-error-watcher.tsx` (`t("title")`, `t("defaultMessage")` in the `Auth.errorWatcher` namespace).
- **Shortcut:** the namespace defines `authError`, `unknownError`, `loginFailed` and `problemSigningIn`; `title` and `defaultMessage` do not exist in either locale.
- **Risk:** when a login redirect carries an error, the toast shows a missing-message fallback instead of a readable message.
- **Done when:** the component uses the existing keys and a test renders the toast for both the query-string and the hash error.

## Mobile reset menu item ignores the reset flag

- **Where:** `components/game/mobile-reset-item.tsx`, rendered unconditionally in `components/game/game-header.tsx`.
- **Shortcut:** the desktop reset button returns `null` unless `NEXT_PUBLIC_GAME_RESET_ENABLED` is `"true"`, but the mobile menu item has no such check. The server action refuses the reset when the flag is off, and the item only logs the failure to the console.
- **Risk:** every mobile player sees a debug "Resetuj" item that does nothing visible when confirmed.
- **Done when:** the mobile item uses the same flag check as the desktop button, with a test for both flag values.

## Toasts and captcha ignore the in-app theme

- **Where:** `components/ui/sonner.tsx` and `components/auth/captcha.tsx` (`useTheme()` from `next-themes`).
- **Shortcut:** no `ThemeProvider` from `next-themes` is mounted; the app sets dark mode itself through the `.dark` class and `localStorage` key `fragrance-game-theme`. The hook therefore always returns its default, so toasts follow the system theme and the Turnstile widget never receives the in-app choice.
- **Risk:** with dark mode chosen in the menu on a light system (or the reverse), toasts and the captcha widget use the other theme.
- **Done when:** both components read the theme from the app's own UI preferences, or a `next-themes` provider is mounted and wired to the existing toggle, and `next-themes` is removed if unused.

## Striped placeholder pattern is invalid CSS

- **Where:** `app/globals.css` (`@utility bg-striped-pattern`), used by the hidden note badges in `components/game/clues/pyramid-clues.tsx`.
- **Shortcut:** the gradient stops use `oklch(var(--color-foreground) / 0.06)`, but `--color-foreground` already holds a complete `oklch()` value, so the declaration is invalid and the browser drops it.
- **Risk:** the first-attempt note placeholders lose their intended striped look without any error.
- **Done when:** the stops use `color-mix(in oklch, var(--color-foreground) 6%, transparent)` (or an equivalent valid form) and the stripes are confirmed in both themes.

## Error pages are untranslated and unstyled

- **Where:** `app/[locale]/not-found.tsx`, `app/global-error.tsx`.
- **Shortcut:** the 404 page is hard-coded English text without the game's header, fonts or palette; the global error page is the default Next.js error with `lang="en"`.
- **Risk:** a mistyped link or a crash drops players onto a page that looks unrelated to the game, in the wrong language.
- **Done when:** both pages use the game's layout and tokens, read their text from `messages/*.json` in both locales, and offer a way back to today's game.
