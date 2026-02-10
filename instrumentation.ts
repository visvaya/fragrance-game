export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Client-side Sentry is auto-imported by Next.js via sentry.client.config.ts
// It doesn't use instrumentation.ts - it's loaded via _app or layout
