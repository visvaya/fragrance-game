import type { createClient } from "./client";

/**
 * Lazy Supabase client loader.
 *
 * Returns a Supabase browser client. Importing THIS module is cheap — it does not pull
 * in the Supabase bundle at static-import time. The heavy `@supabase/ssr` bundle is only
 * loaded when `getSupabaseClient()` is first called (inside a `useEffect` or async handler).
 *
 * Components that import this file statically can still be mocked in tests via vi.mock().
 */
export async function getSupabaseClient(): Promise<ReturnType<typeof createClient>> {
  const { createClient: create } = await import("./client");
  return create();
}
