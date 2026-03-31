import fs from "fs";
import type { FullConfig } from "@playwright/test";
import { TEST_USER_IDS_FILE } from "./global-setup";

/**
 * Playwright global teardown — deletes anonymous test users created by globalSetup.
 *
 * Reads user IDs saved by globalSetup and calls DELETE /auth/v1/admin/users/{id}
 * for each one, preventing test accounts from polluting player statistics.
 * Test users are also flagged with user_metadata.is_test_user=true as a secondary
 * guard — statistics queries can filter on that field even if teardown was skipped.
 */
export default async function globalTeardown(_config: FullConfig): Promise<void> {
  if (!fs.existsSync(TEST_USER_IDS_FILE)) {
    console.warn("[E2E globalTeardown] No test user IDs file found — skipping cleanup");
    return;
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let userIds: string[];

  try {
    const raw = JSON.parse(fs.readFileSync(TEST_USER_IDS_FILE, "utf8")) as {
      supabaseUrl: string;
      serviceRoleKey: string;
      userIds: string[];
    };
    supabaseUrl = raw.supabaseUrl;
    serviceRoleKey = raw.serviceRoleKey;
    userIds = raw.userIds;
  } catch {
    console.warn("[E2E globalTeardown] Failed to parse test user IDs file — skipping cleanup");
    return;
  }

  console.log(`[E2E globalTeardown] Deleting ${userIds.length} test users...`);

  const results = await Promise.allSettled(
    userIds.map((userId) =>
      fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }).then((res) => {
        if (!res.ok && res.status !== 404) {
          console.warn(`[E2E globalTeardown] Failed to delete user ${userId}: HTTP ${res.status}`);
        } else {
          console.log(`[E2E globalTeardown] Deleted test user: ${userId}`);
        }
      }),
    ),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`[E2E globalTeardown] ${failed} user deletion(s) threw an error`);
  }

  // Clean up the IDs file regardless of deletion outcome.
  fs.unlinkSync(TEST_USER_IDS_FILE);
}
