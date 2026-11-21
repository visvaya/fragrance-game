import type { init } from "@sentry/nextjs";

type SentryOptions = NonNullable<Parameters<typeof init>[0]>;

/** Header and query names that can carry the player's address or identity. */
const IDENTITY_FIELDS = ["forwarded", "-ip", "remote-", "via", "-user"];

/**
 * What the Sentry SDK may collect, shared by the browser, server and edge setups. Sentry 11
 * collects user data, cookies, request bodies and database queries when this is unset, so the
 * SDK 10 defaults are spelled out here: no player data beyond what `scrubEvent` keeps.
 */
export const SENTRY_DATA_COLLECTION = {
  cookies: false,
  databaseQueryData: false,
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
  httpBodies: [],
  httpHeaders: {
    request: { deny: IDENTITY_FIELDS },
    response: { deny: IDENTITY_FIELDS },
  },
  queues: false,
  urlQueryParams: { deny: IDENTITY_FIELDS },
  userInfo: false,
} satisfies SentryOptions["dataCollection"];
