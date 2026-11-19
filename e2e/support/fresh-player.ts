import { test as base } from "@playwright/test";

import {
  buildSessionCookies,
  createAnonymousSession,
  loadSupabaseAdminConfig,
  parseProjectReference,
} from "../global-setup";
import { createE2eAdminClient, deleteTestUser } from "./admin";

/** Admin API configuration, or an error naming what is missing. */
function requireAdminConfig(): { serviceRoleKey: string; supabaseUrl: string } {
  const config = loadSupabaseAdminConfig();
  if (!config) {
    throw new Error(
      "Fresh-player tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return config;
}

/**
 * Playwright `test` whose browser context belongs to a new anonymous player, created through
 * the Admin API (no captcha) before each test and deleted after it. Tests that play the daily
 * game use it, so no test depends on what another test did with a shared player.
 */
export const test = base.extend({
  context: async ({ context }, provide) => {
    const config = requireAdminConfig();
    const projectReference = parseProjectReference(config.supabaseUrl);
    const session = await createAnonymousSession(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const userId = session?.user?.id;
    if (!session || !userId || !projectReference) {
      throw new Error("Could not create a fresh anonymous player");
    }

    await context.addCookies(buildSessionCookies(session, projectReference));
    await provide(context);
    await deleteTestUser(createE2eAdminClient(config), userId);
  },
});

export { expect } from "@playwright/test";
