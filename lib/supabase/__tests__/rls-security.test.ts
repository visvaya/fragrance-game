/* eslint-disable vitest/no-duplicate-hooks, no-restricted-syntax, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeAll, vi } from "vitest";

/**
 * RLS Security Tests - Database Access Control
 *
 * These tests verify that Row Level Security (RLS) policies
 * and VIEW permissions are correctly configured to prevent
 * unauthorized access to sensitive data.
 *
 * CRITICAL: These tests protect against data leaks!
 *
 * NOTE: These tests require actual database connection.
 * Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 * Run with: pnpm vitest run lib/supabase/__tests__/rls-security.test.ts
 */

// Import after setting env vars
import { createClient, createAdminClient } from "../server";

// Skip these tests unless explicitly running integration tests against a live database.
// These tests require a real Supabase connection — they cannot use mocked values.
// To run: VITEST_INTEGRATION=true pnpm vitest run lib/supabase/__tests__/rls-security.test.ts
const skipIfNoEnvironment =
  // eslint-disable-next-line no-restricted-properties -- integration test environment check
  process.env.VITEST_INTEGRATION === "true" ? describe : describe.skip;

skipIfNoEnvironment("RLS Security - perfumes_public VIEW", () => {
  let anonClient: Awaited<ReturnType<typeof createClient>>;
  let adminClient: ReturnType<typeof createAdminClient>;

  beforeAll(async () => {
    anonClient = await createClient(); // Anonymous/authenticated client
    adminClient = createAdminClient(); // Service role client
  });

  describe("perfumes_public VIEW - Column-Level Security", () => {
    it("CRITICAL: perfumes_public does NOT expose top_notes", async () => {
      // ATTACK: Try to read top_notes from public VIEW
      const { data, error } = await anonClient
        .from("perfumes_public")
        .select("top_notes")
        .limit(1);

      // EXPECTED: Column doesn't exist (removed from VIEW)
      expect(error).toBeTruthy();
      expect(error?.message).toContain("top_notes");
      expect(data).toBeNull();
    });

    it("CRITICAL: perfumes_public does NOT expose middle_notes", async () => {
      const { data, error } = await anonClient
        .from("perfumes_public")
        .select("middle_notes")
        .limit(1);

      expect(error).toBeTruthy();
      expect(error?.message).toContain("middle_notes");
      expect(data).toBeNull();
    });

    it("CRITICAL: perfumes_public does NOT expose base_notes", async () => {
      const { data, error } = await anonClient
        .from("perfumes_public")
        .select("base_notes")
        .limit(1);

      expect(error).toBeTruthy();
      expect(error?.message).toContain("base_notes");
      expect(data).toBeNull();
    });

    it("CRITICAL: perfumes_public does NOT expose xsolve_score", async () => {
      // xsolve_score is proprietary difficulty algorithm
      const { data, error } = await anonClient
        .from("perfumes_public")
        .select("xsolve_score")
        .limit(1);

      expect(error).toBeTruthy();
      expect(error?.message).toContain("xsolve_score");
      expect(data).toBeNull();
    });

    it("allows reading basic metadata from perfumes_public", async () => {
      // Public metadata should be accessible
      const { data, error } = await anonClient
        .from("perfumes_public")
        .select("id, name, brand_name, release_year, gender")
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBeDefined();
      expect(data?.name).toBeDefined();
    });

    it("SELECT * from perfumes_public does NOT include notes", async () => {
      // ATTACK: Try to dump entire dataset with SELECT *
      const { data, error } = await anonClient
        .from("perfumes_public")
        .select("*")
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // CRITICAL: Notes should NOT be in response
      expect(data).not.toHaveProperty("top_notes");
      expect(data).not.toHaveProperty("middle_notes");
      expect(data).not.toHaveProperty("base_notes");
      expect(data).not.toHaveProperty("xsolve_score");

      // But basic data should be present
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("brand_name");
    });
  });

  describe("perfumes TABLE - Direct Access Protection", () => {
    it("CRITICAL: anonymous user CANNOT read perfumes table directly", async () => {
      // ATTACK: Try to bypass VIEW and read table directly
      const { data, error } = await anonClient
        .from("perfumes")
        .select("*")
        .limit(1);

      // EXPECTED: Permission denied (table access blocked)
      expect(error).toBeTruthy();
      expect(data).toBeNull();

      // Error should indicate permission issue
      // Note: Error code may vary (42501 = insufficient privilege, PGRST116 = no rows)
      const errorMessage = error?.message.toLowerCase() || "";
      const hasPermissionError =
        errorMessage.includes("permission") ||
        errorMessage.includes("denied") ||
        errorMessage.includes("policy") ||
        error?.code === "42501";

      expect(hasPermissionError).toBe(true);
    });

    it("CRITICAL: anonymous user CANNOT read notes from perfumes table", async () => {
      const { data, error } = await anonClient
        .from("perfumes")
        .select("top_notes, middle_notes, base_notes")
        .limit(1);

      expect(error).toBeTruthy();
      expect(data).toBeNull();
    });
  });

  describe("Admin Client - Authorized Access", () => {
    it("Admin Client CAN read notes from perfumes table", async () => {
      // Server Actions use Admin Client (service_role)
      const { data, error } = await adminClient
        .from("perfumes")
        .select("id, name, top_notes, middle_notes, base_notes")
        .not("top_notes", "is", null)
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.top_notes).toBeDefined();
      expect(Array.isArray(data?.top_notes)).toBe(true);
    });

    it("Admin Client CAN read xsolve_score from perfumes table", async () => {
      const { data, error } = await adminClient
        .from("perfumes")
        .select("id, name, xsolve_score")
        .not("xsolve_score", "is", null)
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.xsolve_score).toBeDefined();
      expect(typeof data?.xsolve_score).toBe("number");
    });
  });
});

skipIfNoEnvironment("RLS Security - daily_challenges_public VIEW", () => {
  let anonClient: Awaited<ReturnType<typeof createClient>>;

  beforeAll(async () => {
    anonClient = await createClient();
  });

  describe("daily_challenges_public VIEW - perfume_id Protection", () => {
    it("CRITICAL: daily_challenges_public does NOT expose perfume_id", async () => {
      // ATTACK: Try to read perfume_id from public VIEW
      const { data, error } = await anonClient
        .from("daily_challenges_public")
        .select("perfume_id")
        .limit(1);

      // EXPECTED: Column doesn't exist (removed from VIEW)
      expect(error).toBeTruthy();
      expect(error?.message).toContain("perfume_id");
      expect(data).toBeNull();
    });

    it("allows reading basic challenge metadata", async () => {
      const { data, error } = await anonClient
        .from("daily_challenges_public")
        .select("id, challenge_date, mode, grace_deadline_at_utc")
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBeDefined();
      expect(data?.challenge_date).toBeDefined();
    });

    it("SELECT * from daily_challenges_public does NOT include perfume_id", async () => {
      // ATTACK: Try to get perfume_id with SELECT *
      const { data, error } = await anonClient
        .from("daily_challenges_public")
        .select("*")
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // CRITICAL: perfume_id should NOT be in response
      expect(data).not.toHaveProperty("perfume_id");

      // But basic data should be present
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("challenge_date");
    });
  });

  describe("daily_challenges TABLE - Direct Access Protection", () => {
    it("CRITICAL: anonymous user CANNOT read daily_challenges table directly", async () => {
      // ATTACK: Try to bypass VIEW and read table directly
      const { data, error } = await anonClient
        .from("daily_challenges")
        .select("*")
        .limit(1);

      // EXPECTED: Permission denied or no results (RLS blocks access)
      expect(error).toBeTruthy();
      expect(data).toBeNull();
    });

    it("CRITICAL: anonymous user CANNOT read perfume_id from daily_challenges", async () => {
      const { data, error } = await anonClient
        .from("daily_challenges")
        .select("perfume_id")
        .limit(1);

      expect(error).toBeTruthy();
      expect(data).toBeNull();
    });
  });
});

skipIfNoEnvironment("RLS Security - Attack Scenario Prevention", () => {
  let anonClient: Awaited<ReturnType<typeof createClient>>;

  beforeAll(async () => {
    anonClient = await createClient();
  });

  it("CRITICAL: prevents dataset mass scraping attack", async () => {
    // ATTACK SCENARIO: Competitor tries to dump entire dataset
    const { data, error } = await anonClient
      .from("perfumes_public")
      .select("id, name, top_notes, middle_notes, base_notes")
      .limit(10_000);

    // EXPECTED: Query fails (notes columns don't exist)
    expect(error).toBeTruthy();
    expect(data).toBeNull();

    // Even if they try without notes, they can't get xsolve_score
    const { data: data2, error: error2 } = await anonClient
      .from("perfumes_public")
      .select("id, name, xsolve_score")
      .limit(10_000);

    expect(error2).toBeTruthy();
    expect(data2).toBeNull();
  });

  it("CRITICAL: prevents cheating via note matching", async () => {
    // ATTACK SCENARIO: User tries to find perfume by matching notes
    const clues = ["Lavender", "Bergamot", "Lemon"];

    // Try to search by top_notes
    const { data, error } = await anonClient
      .from("perfumes_public")
      .select("*")
      .contains("top_notes", clues);

    // EXPECTED: Query fails (top_notes column doesn't exist)
    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });

  it("CRITICAL: prevents answer discovery via daily_challenges + perfumes join", async () => {
    // ATTACK SCENARIO: User tries to join daily_challenges with perfumes
    // to discover today's answer

    // Step 1: Get today's challenge (should work - gives id, NOT perfume_id)
    const { data: challenge } = await anonClient
      .from("daily_challenges_public")
      .select("id, challenge_date")
      .limit(1)
      .single();

    expect(challenge).toBeDefined();
    expect(challenge).not.toHaveProperty("perfume_id");

    // Step 2: Try to read perfumes table directly (should fail)
    const { data: perfumes, error } = await anonClient
      .from("perfumes")
      .select("*")
      .limit(1);

    expect(error).toBeTruthy();
    expect(perfumes).toBeNull();

    // EXPECTED: Cannot discover answer because:
    // 1. daily_challenges_public doesn't have perfume_id
    // 2. perfumes table is not accessible to anon users
  });
});
