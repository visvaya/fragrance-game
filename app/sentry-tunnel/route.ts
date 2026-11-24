// The Sentry tunnel (`tunnelRoute` in next.config.ts). Without this file the Sentry build writes
// the same handler on Vercel, with the platform's 300 s limit. The handler streams the browser's
// upload to Sentry, so a browser that leaves mid-upload holds the function until the limit; an
// envelope takes well under a second.
export { POST } from "@sentry/nextjs/tunnel";

/** Longest run of one tunnel request, in seconds. */
export const maxDuration = 10;
