import { NextResponse } from "next/server";

/**
 * Healthcheck endpoint for monitoring and testing
 *
 * Used by:
 * - Vercel health checks
 * - Rate limiting E2E tests
 * - Uptime monitoring services
 */
export async function GET() {
  await Promise.resolve();
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

export const dynamic = "force-dynamic";
