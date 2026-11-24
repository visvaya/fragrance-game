import createBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const assetsHost = process.env.NEXT_PUBLIC_ASSETS_HOST?.trim();
if (!assetsHost && process.env.SKIP_ENV_VALIDATION !== "1") {
  throw new Error(
    "NEXT_PUBLIC_ASSETS_HOST is required: set it to the public image host (no scheme).",
  );
}

const withNextIntl = createNextIntlPlugin();
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-icons",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-label",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-tooltip",
    ],
    turbopackFileSystemCacheForDev: true,
  },
  serverExternalPackages: [
    "@opentelemetry/instrumentation",
    "@opentelemetry/semantic-conventions",
    "@apm-js-collab/code-transformer",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    remotePatterns: [
      ...(assetsHost
        ? [
            {
              protocol: "https" as const,
              hostname: assetsHost,
              port: "",
              pathname: "/a/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
    ],
  },
  poweredByHeader: false,
  agentRules: false,
  async rewrites() {
    const posthogHost =
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://pub-2c37ff9f03ea40878492e7f72ef83fe3.supabase.co";

    return [
      {
        source: "/ph-proxy/static/:path*",
        destination: `${posthogHost.replace("eu.i", "eu-assets.i")}/static/:path*`,
      },
      {
        source: "/ph-proxy/:path*",
        destination: `${posthogHost}/:path*`,
      },
      {
        source: "/ph-proxy/decide",
        destination: `${posthogHost}/decide`,
      },
      // Supabase Proxy
      {
        source: "/api/db/:path*",
        destination: `${supabaseUrl}/:path*`,
      },
    ];
  },
};

const serverConfig = withSentryConfig(nextConfig, {
  // Build options: https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/
  // Source map upload needs both; without them (local builds) the build skips it.
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT
    ? { project: process.env.SENTRY_PROJECT }
    : {}),
  // Suppresses source map upload logs during build.
  silent: true,
  // Uploads a larger set of source maps for clearer stack traces (longer build).
  widenClientFileUpload: true,
  // Sends browser events through this app, so ad blockers and the Sentry domain filter do not
  // drop them. proxy.ts lets the route through without the API rate limit.
  tunnelRoute: "/api/monitoring",
  // Leaves out SDK parts the app does not use. Tracing stays: the server samples 10% of requests.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
  webpack: {
    // Creates Sentry cron monitors for the Vercel cron jobs (https://docs.sentry.io/product/crons/).
    automaticVercelMonitors: true,
  },
});

export default withNextIntl(withBundleAnalyzer(serverConfig));
