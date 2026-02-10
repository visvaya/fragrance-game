import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@radix-ui/react-icons",
    ],
  },
  images: {
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Server",
            value: "",
          },
        ],
      },
      {
        source: "/:path*(woff2?|png|jpg|jpeg|gif|webp|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
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
    org: "fragrance-game",
    project: "fragrance-webapp",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: false, // Modern browsers only

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: "/api/monitoring",
  },
);

export default withNextIntl(serverConfig);
