// @vitest-environment node
/**
 * The generate-daily cron against a real database: the route, `pick_daily_perfume` and the table
 * constraints together. The suite deletes every challenge, asset, perfume, brand and concentration,
 * so it runs only against a local Supabase stack and refuses any other host.
 *
 * Start the local stack (`supabase start`), then run with its API URL and service role key:
 * TEST_SUPABASE_URL=http://127.0.0.1:54321 TEST_SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   pnpm vitest run app/api/cron/generate-daily/__tests__/algorithm.integration.test.ts
 */

import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database, TablesInsert } from "@/types/supabase";

// eslint-disable-next-line no-restricted-properties -- integration test environment check
const testEnv = process.env;
const {
  TEST_SUPABASE_SERVICE_ROLE_KEY: TEST_KEY = "",
  TEST_SUPABASE_URL: TEST_URL = "",
} = testEnv;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** A service role client for the local stack; any other host would have its tables wiped. */
const localClient = (): SupabaseClient<Database> => {
  const { hostname } = new URL(TEST_URL);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `TEST_SUPABASE_URL must point to a local stack, got host ${hostname}`,
    );
  }
  return createClient<Database>(TEST_URL, TEST_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const db = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => db.client,
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const { GET } = await import("../route");

const runCron = async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/cron/generate-daily", {
      headers: { authorization: "Bearer test-cron-secret" },
    }),
  );
  return { body: (await response.json()) as unknown, status: response.status };
};

const isoDate = (daysFromToday: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
};

const assetKeys = () => {
  const assetId = randomBytes(16).toString("hex");
  const key = () => `a/${assetId}/${randomBytes(16).toString("hex")}.avif`;
  return {
    asset_random_id: assetId,
    image_key_step_1: key(),
    image_key_step_2: key(),
    image_key_step_3: key(),
    image_key_step_4: key(),
    image_key_step_5: key(),
    image_key_step_6: key(),
  };
};

describe.skipIf(!TEST_URL || !TEST_KEY)(
  "generate-daily on a local database",
  () => {
    let supabase: SupabaseClient<Database>;
    let brandId: string;

    /** Inserts a perfume (eligible unless overridden) and, unless `withAssets` is false, its images. */
    const addPerfume = async (
      name: string,
      overrides: Partial<TablesInsert<"perfumes">> = {},
      withAssets = true,
    ): Promise<string> => {
      const { data, error } = await supabase
        .from("perfumes")
        .insert({
          brand_id: brandId,
          is_active: true,
          is_uncertain: false,
          name,
          source_record_slug: name,
          top_notes: ["Bergamot"],
          // The set_unique_slug trigger overwrites this; the generated types do not know it.
          unique_slug: "set-by-trigger",
          xsolve_score: 0.42,
          ...overrides,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Seeding ${name} failed: ${error.message}`);
      if (withAssets) {
        const assets = await supabase
          .from("perfume_assets")
          .insert({ ...assetKeys(), perfume_id: data.id });
        if (assets.error)
          throw new Error(`Seeding assets failed: ${assets.error.message}`);
      }
      return data.id;
    };

    const addChallenge = async (
      perfumeId: string,
      daysFromToday: number,
      number: number,
    ) => {
      const date = isoDate(daysFromToday);
      const { error } = await supabase.from("daily_challenges").insert({
        challenge_date: date,
        challenge_number: number,
        grace_deadline_at_utc: `${date}T23:59:59.999Z`,
        mode: "standard",
        perfume_id: perfumeId,
        seed_hash: `test-${number}`,
        snapshot_metadata: {},
      });
      if (error) throw new Error(`Seeding challenge failed: ${error.message}`);
    };

    const challengesFrom = async (daysFromToday: number) => {
      const { data, error } = await supabase
        .from("daily_challenges")
        .select(
          "challenge_date, challenge_number, perfume_id, snapshot_metadata",
        )
        .gte("challenge_date", isoDate(daysFromToday))
        .order("challenge_date")
        .limit(10);
      if (error) throw new Error(error.message);
      return data;
    };

    beforeEach(async () => {
      supabase = localClient();
      db.client = supabase;
      for (const table of [
        "daily_challenges",
        "perfume_assets",
        "perfumes",
        "brands",
      ] as const) {
        const column = table === "perfume_assets" ? "perfume_id" : "id";
        const { error } = await supabase
          .from(table)
          .delete()
          .not(column, "is", null);
        if (error)
          throw new Error(`Clearing ${table} failed: ${error.message}`);
      }
      const { data, error } = await supabase
        .from("brands")
        .insert({ name: "Test Brand", slug: "test-brand" })
        .select("id")
        .single();
      if (error) throw new Error(`Seeding the brand failed: ${error.message}`);
      brandId = data.id;
    });

    it("creates today's and tomorrow's puzzles from eligible perfumes only", async () => {
      const eligible = [
        await addPerfume("eligible-a"),
        await addPerfume("eligible-b"),
      ];
      await addPerfume("uncertain", { is_uncertain: true });
      await addPerfume("inactive", { is_active: false });
      await addPerfume("no-score", { xsolve_score: null });
      await addPerfume("no-top-notes", { top_notes: [] });
      await addPerfume("no-images", {}, false);

      const run = await runCron();

      expect(run.status).toBe(200);
      const created = await challengesFrom(0);
      expect(
        created.map((c) => [c.challenge_date, c.challenge_number]),
      ).toEqual([
        [isoDate(0), 1],
        [isoDate(1), 2],
      ]);
      expect(new Set(created.map((c) => c.perfume_id))).toEqual(
        new Set(eligible),
      );
      expect(created.map((c) => c.snapshot_metadata)).toEqual([
        { xsolve: 0.42 },
        { xsolve: 0.42 },
      ]);
    });

    it("leaves existing puzzles alone on a second run", async () => {
      await addPerfume("eligible-a");
      await addPerfume("eligible-b");
      await addPerfume("eligible-c");
      await runCron();
      const before = await challengesFrom(0);

      const run = await runCron();

      expect(run.body).toMatchObject({
        results: [{ status: "exists" }, { status: "exists" }],
      });
      expect(await challengesFrom(0)).toEqual(before);
    });

    it("numbers new puzzles after the highest existing number", async () => {
      const used = await addPerfume("used-long-ago");
      await addPerfume("eligible-a");
      await addPerfume("eligible-b");
      await addChallenge(used, -60, 41);

      await runCron();

      const created = await challengesFrom(0);
      expect(created.map((c) => c.challenge_number)).toEqual([42, 43]);
    });

    it("falls back to the 7-day window when the 30-day pool is empty", async () => {
      const usedTenDaysAgo = await addPerfume("used-ten-days-ago");
      const usedTwentyDaysAgo = await addPerfume("used-twenty-days-ago");
      await addChallenge(usedTwentyDaysAgo, -20, 1);
      await addChallenge(usedTenDaysAgo, -10, 2);

      const run = await runCron();

      expect(run.status).toBe(200);
      const created = await challengesFrom(0);
      expect(created).toHaveLength(2);
      expect(new Set(created.map((c) => c.perfume_id))).toEqual(
        new Set([usedTenDaysAgo, usedTwentyDaysAgo]),
      );
    });

    it("fails without inserting when no perfume is left in the 7-day window", async () => {
      const usedYesterday = await addPerfume("used-yesterday");
      await addChallenge(usedYesterday, -1, 1);

      const run = await runCron();

      expect(run.status).toBe(500);
      expect(await challengesFrom(0)).toEqual([]);
    });
  },
);
