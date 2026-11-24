import { NextResponse } from "next/server";

import { version } from "@/package.json";

/**
 * Healthcheck endpoint for monitoring and testing
 *
 * Used by:
 * - Vercel health checks
 * - Rate limiting E2E tests
 * - Uptime monitoring services
 * - The release job, which waits until production serves the version it is about to tag
 */
export async function GET(): Promise<Response> {
  await Promise.resolve();
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version,
    },
    { status: 200 },
  );
}

export const dynamic = "force-dynamic";
