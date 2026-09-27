# Known technical debt

Deliberate shortcuts that are safe for now but should be paid off. Each entry says where the shortcut lives and what "done" means. Remove an entry when it is resolved.

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

## Coverage thresholds below the target

- **Where:** `vitest.config.ts` (`coverage.thresholds`).
- **Shortcut:** thresholds sit at the current level so CI stays green; the target is lines 80, functions 75, branches 70.
- **Done when:** thresholds reach the target. Raise them whenever coverage grows; never lower them.

## Sentry example page ships to production

- **Where:** `app/sentry-example-page/` (route `/sentry-example-page`).
- **Shortcut:** leftover from the Sentry setup wizard.
- **Done when:** the page is deleted and error reporting is confirmed through a real error.
