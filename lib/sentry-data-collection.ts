import type { init } from "@sentry/nextjs";

type SentryOptions = NonNullable<Parameters<typeof init>[0]>;

/** Headers that help reproduce an error and carry no player identity. */
const DIAGNOSTIC_HEADERS = ["user-agent", "accept-language", "content-type"];

/**
 * What the Sentry SDK may collect, shared by the browser, server and edge setups. Sentry 11
 * collects user data, cookies, request bodies and database queries when this is unset; this
 * keeps less than the SDK 10 defaults did. URL query strings stay out because they carry login
 * codes (`/auth/callback?code=`) and preview share tokens, and headers are an allow list.
 * `scrubEvent` still filters what is left.
 */
export const SENTRY_DATA_COLLECTION = {
  cookies: false,
  databaseQueryData: false,
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
  httpBodies: [],
  httpHeaders: {
    request: { allow: DIAGNOSTIC_HEADERS },
    response: { allow: ["content-type"] },
  },
  queues: false,
  stackFrameVariables: false,
  urlQueryParams: false,
  userInfo: false,
} satisfies SentryOptions["dataCollection"];
