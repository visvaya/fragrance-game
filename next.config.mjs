import { withSentryConfig } from "@sentry/nextjs";
import createBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@radix-ui/react-icons",
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
      {
        protocol: "https",
        hostname:
          process.env.NEXT_PUBLIC_ASSETS_HOST ||
          "pub-2c37ff9f03ea40878492e7f72ef83fe3.r2.dev",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
    ],
  },
  poweredByHeader: false,
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

const serverConfig = withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: false, // Modern browsers only

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: "/api/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Optimization: Reduce bundle size by excluding features we don't use
    bundleSizeOptimizations: {
      excludeDebugStatements: true,
      excludeReplayShadowDom: true,
      excludeReplayWorker: true,
      excludeTracing: true, // Optimized: disable tracing on client
    },
  },
);

export default withNextIntl(withBundleAnalyzer(serverConfig));
