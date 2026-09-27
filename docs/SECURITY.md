# Security Policy

## Supported versions

Only the version deployed at [eauxle.vercel.app](https://eauxle.vercel.app), built from the `main` branch, receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Include the affected URL or file, steps to reproduce, and the impact you expect.

You can expect an acknowledgement within 7 days. Once a fix is deployed, the advisory will be published with credit to the reporter, unless you prefer to stay anonymous.

## Scope

In scope: the web application, its API routes and server actions, and the Supabase row-level security policies in `supabase/migrations/`.

Out of scope: denial-of-service and volume-based attacks, findings in third-party services (Vercel, Supabase, Upstash, Sentry, PostHog) that are not caused by this project's configuration, and reports from automated scanners without a demonstrated impact.
