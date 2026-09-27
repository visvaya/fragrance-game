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

## pnpm settings are duplicated for Vercel

- **Where:** `package.json` (`"pnpm"` field) and `pnpm-workspace.yaml` (`overrides`, `peerDependencyRules`, `allowBuilds`, `onlyBuiltDependencies`).
- **Shortcut:** local development and CI run pnpm 11 (pinned by `packageManager`), which reads only `pnpm-workspace.yaml`. Vercel picks pnpm 9 or 10 from `lockfileVersion` unless Corepack is enabled, and pnpm 9 reads only the `package.json` field. Both copies must stay identical.
- **Risk:** an override added in one place only silently disappears in the other environment.
- **Done when:** the Vercel project has `ENABLE_EXPERIMENTAL_COREPACK=1` (so Vercel also uses pnpm 11), then the `"pnpm"` field and `onlyBuiltDependencies` are removed.

## Vulnerable development dependencies

- **Where:** dev tooling in `package.json` (artillery, ESLint plugins, commitlint, madge, depcheck and their transitive dependencies): about 40 high and 3 critical advisories at the time of writing.
- **Shortcut:** the CI audit gate in `security-scan.yml` runs `pnpm audit --prod`, because dev tooling does not ship to users. Production dependencies have no high or critical advisories (vulnerable transitive packages are pinned through `overrides`).
- **Risk:** a compromised or vulnerable tool can still affect a developer machine or CI runner.
- **Done when:** `pnpm audit --audit-level=high` passes without `--prod` (update or replace the tools, add overrides), and the gate drops `--prod`.

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
