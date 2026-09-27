import { describe, expect, it } from "vitest";

import { autocompleteSchema } from "@/lib/validations/game.schema";

describe("autocompleteSchema", () => {
  describe("query validation", () => {
    it("accepts a valid query string", () => {
      const result = autocompleteSchema.safeParse({ query: "Dior" });
      expect(result.success).toBe(true);
    });

    it("accepts a single character query (min = 1)", () => {
      const result = autocompleteSchema.safeParse({ query: "D" });
      expect(result.success).toBe(true);
    });

    it("accepts exactly 100-char query (max boundary)", () => {
      const result = autocompleteSchema.safeParse({ query: "a".repeat(100) });
      expect(result.success).toBe(true);
    });

    it("rejects empty string (below min = 1)", () => {
      const result = autocompleteSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("rejects 101-char query (above max = 100)", () => {
      const result = autocompleteSchema.safeParse({ query: "a".repeat(101) });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].code).toBe("too_big");
    });

    it("accepts query with special characters", () => {
      const result = autocompleteSchema.safeParse({
        query: "L'Occitane & Hermès",
      });
      expect(result.success).toBe(true);
    });

    it("accepts query with XSS-like content (validation is structural, not sanitization)", () => {
      // Zod validates structure only — sanitization is handled elsewhere
      const result = autocompleteSchema.safeParse({
        query: "<script>alert(1)</script>",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing query field", () => {
      const result = autocompleteSchema.safeParse({
        sessionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("sessionId validation (optional)", () => {
    it("accepts valid UUID v4 sessionId", () => {
      const result = autocompleteSchema.safeParse({
        query: "Chanel",
        sessionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });
      expect(result.success).toBe(true);
    });

    it("accepts missing sessionId (optional field)", () => {
      const result = autocompleteSchema.safeParse({ query: "Chanel" });
      expect(result.success).toBe(true);
    });

    it("rejects non-UUID sessionId", () => {
      const result = autocompleteSchema.safeParse({
        query: "Chanel",
        sessionId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty string as sessionId", () => {
      const result = autocompleteSchema.safeParse({
        query: "Chanel",
        sessionId: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects null sessionId (use undefined to omit, not null)", () => {
      const result = autocompleteSchema.safeParse({
        query: "Chanel",
        sessionId: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("parsed output shape", () => {
    it("returns the exact parsed values", () => {
      const sessionId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      const result = autocompleteSchema.parse({ query: "Dior", sessionId });

      expect(result.query).toBe("Dior");
      expect(result.sessionId).toBe(sessionId);
    });

    it("returns undefined for omitted optional sessionId", () => {
      const result = autocompleteSchema.parse({ query: "Dior" });

      expect(result.sessionId).toBeUndefined();
    });
  });
});
