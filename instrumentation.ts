export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Client-side Sentry is initialized via instrumentation-client.ts in Next.js 15+
// It is also manually loaded via SentryProvider for deferred initialization

export const onRequestError = async (err: any, request: any, context: any) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request, context);
  } else if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime support for Sentry
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request, context);
  }
};
