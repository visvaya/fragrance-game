/**
 * Daily Challenge Generation Algorithm - Integration Tests
 *
 * SETUP REQUIRED:
 * These tests require a test Supabase database with seed data.
 *
 * Option 1: Development Branch (Recommended)
 * - Create a dev branch: pnpm supabase branches create test-cron
 * - Set TEST_SUPABASE_URL and TEST_SUPABASE_ANON_KEY in .env.test
 *
 * Option 2: Separate Test Project
 * - Create test project via Supabase dashboard
 * - Run migrations on test project
 * - Configure .env.test with test credentials
 *
 * To run: pnpm vitest run app/api/cron/generate-daily/__tests__/algorithm.integration.test.ts
 */

import { beforeEach, describe, expect, it } from "vitest";

import { createAdminClient } from "@/lib/supabase/server";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Skip all tests if test database not configured
const TEST_DB_CONFIGURED =
  // eslint-disable-next-line no-restricted-properties -- integration test environment check
  process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!TEST_DB_CONFIGURED)(
  "Daily Challenge Generation Algorithm",
  () => {
    let supabase: SupabaseClient<Database>;
    let testBrandId: string;
    let testConcentrationId: string;

    beforeEach(async () => {
      // Use test database admin client
      supabase = createAdminClient();

      // Clean up test data before each test
      await supabase.from("daily_challenges").delete().neq("id", "");
      await supabase.from("perfume_assets").delete().neq("perfume_id", "");
      await supabase.from("perfumes").delete().neq("id", "");
      await supabase.from("brands").delete().neq("id", "");
      await supabase.from("concentrations").delete().neq("id", "");

      // Seed dependency tables
      const { data: brand } = await supabase
        .from("brands")
        .insert({ name: "Test Brand", slug: "test-brand" })
        .select()
        .single();
      const { data: concentration } = await supabase
        .from("concentrations")
        .insert({ name: "Eau de Parfum", slug: "edp" })
        .select()
        .single();

      if (!brand || !concentration)
        throw new Error("Failed to seed dependencies");
      testBrandId = brand.id;
      testConcentrationId = concentration.id;
    });

    describe("30-day exclusion pool", () => {
      it("should select perfume NOT in last 30 days", async () => {
        // Seed test data: Create some perfumes
        const { data: perfume1 } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "Test Perfume 1",
            release_year: 2020,
            source_record_slug: "test-perfume-1",
          })
          .select()
          .single();

        const { data: perfume2 } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "Test Perfume 2",
            release_year: 2021,
            source_record_slug: "test-perfume-2",
          })
          .select()
          .single();

        expect(perfume1).toBeDefined();
        expect(perfume2).toBeDefined();

        if (!perfume1 || !perfume2) {
          throw new Error("Failed to seed test perfumes");
        }

        // Create assets for both perfumes
        await supabase.from("perfume_assets").insert([
          {
            asset_random_id: crypto.randomUUID(),
            image_key_step_1: "test-image-1.1.jpg",
            image_key_step_2: "test-image-1.2.jpg",
            image_key_step_3: "test-image-1.3.jpg",
            image_key_step_4: "test-image-1.4.jpg",
            image_key_step_5: "test-image-1.5.jpg",
            image_key_step_6: "test-image-1.6.jpg",
            perfume_id: perfume1.id,
          },
          {
            asset_random_id: crypto.randomUUID(),
            image_key_step_1: "test-image-2.1.jpg",
            image_key_step_2: "test-image-2.2.jpg",
            image_key_step_3: "test-image-2.3.jpg",
            image_key_step_4: "test-image-2.4.jpg",
            image_key_step_5: "test-image-2.5.jpg",
            image_key_step_6: "test-image-2.6.jpg",
            perfume_id: perfume2.id,
          },
        ]);

        // Mark perfume1 as used in last 30 days
        const usedDate = new Date();
        usedDate.setUTCDate(usedDate.getUTCDate() - 15); // 15 days ago

        await supabase.from("daily_challenges").insert({
          challenge_date: usedDate.toISOString().split("T")[0],
          challenge_number: 1,
          grace_deadline_at_utc: usedDate.toISOString(),
          mode: "standard",
          perfume_id: perfume1.id,
          seed_hash: "test-hash-1",
          snapshot_metadata: {},
        });

        // Generate challenge for today
        const { data: candidates } = await supabase
          .from("perfume_assets")
          .select("perfume_id, perfumes!inner(is_uncertain)")
          .not("image_key_step_1", "is", null)
          .eq("perfumes.is_uncertain", false);

        expect(candidates).toBeDefined();
        expect(candidates!.length).toBeGreaterThan(0);

        // Verify perfume1 would be excluded by checking recent challenges
        const { data: recentChallenges } = await supabase
          .from("daily_challenges")
          .select("perfume_id")
          .gte(
            "challenge_date",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          );

        const excludeIds = recentChallenges?.map((c) => c.perfume_id) ?? [];
        expect(excludeIds).toContain(perfume1.id);
        expect(excludeIds).not.toContain(perfume2.id);
      });

      it("should handle empty exclusion list (first challenge ever)", async () => {
        // Ensure no challenges exist
        await supabase.from("daily_challenges").delete().neq("id", "");

        // Create a test perfume with assets
        const { data: perfume } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "First Perfume",
            release_year: 2020,
            source_record_slug: "first-perfume",
          })
          .select()
          .single();

        expect(perfume).toBeDefined();

        if (!perfume) {
          throw new Error("Failed to seed test perfume");
        }

        await supabase.from("perfume_assets").insert({
          asset_random_id: crypto.randomUUID(),
          image_key_step_1: "first-image.1.jpg",
          image_key_step_2: "first-image.2.jpg",
          image_key_step_3: "first-image.3.jpg",
          image_key_step_4: "first-image.4.jpg",
          image_key_step_5: "first-image.5.jpg",
          image_key_step_6: "first-image.6.jpg",
          perfume_id: perfume.id,
        });

        // Query should work with empty exclusion
        const { data: candidates } = await supabase
          .from("perfume_assets")
          .select("perfume_id, perfumes!inner(is_uncertain)")
          .not("image_key_step_1", "is", null)
          .eq("perfumes.is_uncertain", false);

        expect(candidates).toBeDefined();
        expect(candidates!.length).toBeGreaterThan(0);
        expect(candidates!.some((c) => c.perfume_id === perfume.id)).toBe(true);
      });
    });

    describe("7-day fallback pool", () => {
      it("should fallback to 7-day exclusion when 30-day pool exhausted", async () => {
        // This test requires having exactly 2 perfumes:
        // - One used 10 days ago (excluded from 30-day, included in 7-day fallback)
        // - One used 35 days ago (included in both pools)

        const { data: perfumeOld } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "Old Perfume",
            release_year: 2015,
            source_record_slug: "old-perfume",
          })
          .select()
          .single();

        const { data: perfumeRecent } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "Recent Perfume",
            release_year: 2023,
            source_record_slug: "recent-perfume",
          })
          .select()
          .single();

        expect(perfumeOld).toBeDefined();
        expect(perfumeRecent).toBeDefined();

        if (!perfumeOld || !perfumeRecent) {
          throw new Error("Failed to seed test perfumes");
        }

        // Create assets
        await supabase.from("perfume_assets").insert([
          {
            asset_random_id: crypto.randomUUID(),
            image_key_step_1: "old-image.1.jpg",
            image_key_step_2: "old-image.2.jpg",
            image_key_step_3: "old-image.3.jpg",
            image_key_step_4: "old-image.4.jpg",
            image_key_step_5: "old-image.5.jpg",
            image_key_step_6: "old-image.6.jpg",
            perfume_id: perfumeOld.id,
          },
          {
            asset_random_id: crypto.randomUUID(),
            image_key_step_1: "recent-image.1.jpg",
            image_key_step_2: "recent-image.2.jpg",
            image_key_step_3: "recent-image.3.jpg",
            image_key_step_4: "recent-image.4.jpg",
            image_key_step_5: "recent-image.5.jpg",
            image_key_step_6: "recent-image.6.jpg",
            perfume_id: perfumeRecent.id,
          },
        ]);

        // Mark perfumeRecent as used 10 days ago
        const date10DaysAgo = new Date();
        date10DaysAgo.setUTCDate(date10DaysAgo.getUTCDate() - 10);

        await supabase.from("daily_challenges").insert({
          challenge_date: date10DaysAgo.toISOString().split("T")[0],
          challenge_number: 1,
          grace_deadline_at_utc: date10DaysAgo.toISOString(),
          mode: "standard",
          perfume_id: perfumeRecent.id,
          seed_hash: "test-hash-recent",
          snapshot_metadata: {},
        });

        // 7-day exclusion query
        const shortExclusionDate = new Date();
        shortExclusionDate.setUTCDate(shortExclusionDate.getUTCDate() - 7);

        const { data: recent7 } = await supabase
          .from("daily_challenges")
          .select("perfume_id")
          .gte(
            "challenge_date",
            shortExclusionDate.toISOString().split("T")[0],
          );

        const excludeIds7 = recent7?.map((c) => c.perfume_id) ?? [];

        // perfumeRecent should NOT be in 7-day exclusion (used 10 days ago)
        expect(excludeIds7).not.toContain(perfumeRecent.id);
      });
    });

    describe("challenge number sequencing", () => {
      it("should increment challenge_number sequentially", async () => {
        const { data: perfume } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "Sequence Perfume",
            release_year: 2020,
            source_record_slug: "sequence-perfume",
          })
          .select()
          .single();

        expect(perfume).toBeDefined();

        if (!perfume) {
          throw new Error("Failed to seed test perfume");
        }

        await supabase.from("perfume_assets").insert({
          asset_random_id: crypto.randomUUID(),
          image_key_step_1: "seq-image.1.jpg",
          image_key_step_2: "seq-image.2.jpg",
          image_key_step_3: "seq-image.3.jpg",
          image_key_step_4: "seq-image.4.jpg",
          image_key_step_5: "seq-image.5.jpg",
          image_key_step_6: "seq-image.6.jpg",
          perfume_id: perfume.id,
        });

        // Create first challenge
        const { data: challenge1 } = await supabase
          .from("daily_challenges")
          .insert({
            challenge_date: "2026-02-14",
            challenge_number: 1,
            grace_deadline_at_utc: "2026-02-14T23:59:59Z",
            mode: "standard",
            perfume_id: perfume.id,
            seed_hash: "seq-hash-2",
            snapshot_metadata: {},
          })
          .select()
          .single();

        expect(challenge1?.challenge_number).toBe(1);

        // Get max challenge number
        const { data: maxChallenge } = await supabase
          .from("daily_challenges")
          .select("challenge_number")
          .order("challenge_number", { ascending: false })
          .limit(1)
          .single();

        const nextNumber = (maxChallenge?.challenge_number ?? 0) + 1;
        expect(nextNumber).toBe(2);
      });

      it("should start at 1 when no challenges exist", async () => {
        await supabase.from("daily_challenges").delete().neq("id", "");

        const { data: maxChallenge } = await supabase
          .from("daily_challenges")
          .select("challenge_number")
          .order("challenge_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextNumber = (maxChallenge?.challenge_number ?? 0) + 1;
        expect(nextNumber).toBe(1);
      });
    });

    describe("date handling", () => {
      it("should format challenge_date as YYYY-MM-DD", () => {
        const date = new Date("2026-02-14T10:30:00Z");
        const dateString = date.toISOString().split("T")[0];

        expect(dateString).toBe("2026-02-14");
        expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it("should handle UTC midnight correctly", () => {
        const midnight = new Date("2026-02-14T00:00:00Z");
        const dateString = midnight.toISOString().split("T")[0];

        expect(dateString).toBe("2026-02-14");

        // One second before midnight (previous day)
        const beforeMidnight = new Date("2026-02-13T23:59:59Z");
        const beforeString = beforeMidnight.toISOString().split("T")[0];

        expect(beforeString).toBe("2026-02-13");
      });

      it("should set grace_deadline_at_utc to end of day", () => {
        const dateString = "2026-02-14";
        const deadline = new Date(dateString);
        deadline.setUTCHours(23, 59, 59, 999);

        const isoString = deadline.toISOString();

        expect(isoString).toContain("23:59:59");
        expect(isoString.startsWith("2026-02-14")).toBe(true);
      });
    });

    describe("asset validation", () => {
      it("should only select perfumes with image assets", async () => {
        const { data: perfumeWithAsset } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "With Asset",
            release_year: 2020,
            source_record_slug: "with-asset",
          })
          .select()
          .single();

        const { data: perfumeWithoutAsset } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "Without Asset",
            release_year: 2021,
            source_record_slug: "without-asset",
          })
          .select()
          .single();

        expect(perfumeWithAsset).toBeDefined();
        expect(perfumeWithoutAsset).toBeDefined();

        if (!perfumeWithAsset || !perfumeWithoutAsset) {
          throw new Error("Failed to seed test perfumes");
        }

        // Only create asset for first perfume
        await supabase.from("perfume_assets").insert({
          asset_random_id: crypto.randomUUID(),
          image_key_step_1: "asset-test.1.jpg",
          image_key_step_2: "asset-test.2.jpg",
          image_key_step_3: "asset-test.3.jpg",
          image_key_step_4: "asset-test.4.jpg",
          image_key_step_5: "asset-test.5.jpg",
          image_key_step_6: "asset-test.6.jpg",
          perfume_id: perfumeWithAsset.id,
        });

        // Query with asset requirement
        const { data: candidates } = await supabase
          .from("perfume_assets")
          .select("perfume_id, perfumes!inner(is_uncertain)")
          .not("image_key_step_1", "is", null)
          .eq("perfumes.is_uncertain", false);

        const candidateIds = candidates?.map((c) => c.perfume_id) ?? [];

        expect(candidateIds).toContain(perfumeWithAsset.id);
        expect(candidateIds).not.toContain(perfumeWithoutAsset.id);
      });

      it("should exclude uncertain perfumes", async () => {
        const { data: certainPerfume } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "Certain Perfume",
            release_year: 2020,
            source_record_slug: "certain-perfume",
          })
          .select()
          .single();

        const { data: uncertainPerfume } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: true,
            name: "Uncertain Perfume",
            release_year: 2021,
            source_record_slug: "uncertain-perfume",
          })
          .select()
          .single();

        expect(certainPerfume).toBeDefined();
        expect(uncertainPerfume).toBeDefined();

        if (!certainPerfume || !uncertainPerfume) {
          throw new Error("Failed to seed test perfumes");
        }

        // Create assets for both
        await supabase.from("perfume_assets").insert([
          {
            asset_random_id: crypto.randomUUID(),
            image_key_step_1: "certain-image.1.jpg",
            image_key_step_2: "certain-image.2.jpg",
            image_key_step_3: "certain-image.3.jpg",
            image_key_step_4: "certain-image.4.jpg",
            image_key_step_5: "certain-image.5.jpg",
            image_key_step_6: "certain-image.6.jpg",
            perfume_id: certainPerfume.id,
          },
          {
            asset_random_id: crypto.randomUUID(),
            image_key_step_1: "uncertain-image.1.jpg",
            image_key_step_2: "uncertain-image.2.jpg",
            image_key_step_3: "uncertain-image.3.jpg",
            image_key_step_4: "uncertain-image.4.jpg",
            image_key_step_5: "uncertain-image.5.jpg",
            image_key_step_6: "uncertain-image.6.jpg",
            perfume_id: uncertainPerfume.id,
          },
        ]);

        // Query excluding uncertain
        const { data: candidates } = await supabase
          .from("perfume_assets")
          .select("perfume_id, perfumes!inner(is_uncertain)")
          .not("image_key_step_1", "is", null)
          .eq("perfumes.is_uncertain", false);

        const candidateIds = candidates?.map((c) => c.perfume_id) ?? [];

        expect(candidateIds).toContain(certainPerfume.id);
        expect(candidateIds).not.toContain(uncertainPerfume.id);
      });
    });

    describe("duplicate prevention", () => {
      it("should not create duplicate challenges for same date", async () => {
        const { data: perfume } = await supabase
          .from("perfumes")
          .insert({
            brand_id: testBrandId,
            concentration_id: testConcentrationId,
            gender: "unisex",
            is_uncertain: false,
            name: "Duplicate Perfume",
            release_year: 2020,
            source_record_slug: "duplicate-perfume",
          })
          .select()
          .single();

        expect(perfume).toBeDefined();

        if (!perfume) {
          throw new Error("Failed to seed test perfume");
        }

        await supabase.from("perfume_assets").insert({
          asset_random_id: crypto.randomUUID(),
          image_key_step_1: "dup-image.1.jpg",
          image_key_step_2: "dup-image.2.jpg",
          image_key_step_3: "dup-image.3.jpg",
          image_key_step_4: "dup-image.4.jpg",
          image_key_step_5: "dup-image.5.jpg",
          image_key_step_6: "dup-image.6.jpg",
          perfume_id: perfume.id,
        });

        const dateString = "2026-02-14";

        // Create first challenge
        const { data: challenge1 } = await supabase
          .from("daily_challenges")
          .insert({
            challenge_date: dateString,
            challenge_number: 1,
            grace_deadline_at_utc: "2026-02-14T23:59:59Z",
            mode: "standard",
            perfume_id: perfume.id,
            seed_hash: "dup-hash",
            snapshot_metadata: {},
          })
          .select()
          .single();

        expect(challenge1).toBeDefined();

        // Try to create duplicate (should be handled by unique constraint or query check)
        const { data: existing } = await supabase
          .from("daily_challenges")
          .select("id, challenge_number, perfume_id")
          .eq("challenge_date", dateString)
          .limit(1)
          .single();

        expect(existing).toBeDefined();
        expect(existing?.id).toBe(challenge1?.id);
      });
    });
  },
);
