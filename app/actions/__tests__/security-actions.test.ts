import { describe, expect, it } from "vitest";

import { validatePasswordSafety } from "@/app/actions/security-actions";

describe("validatePasswordSafety", () => {
  describe("safe passwords", () => {
    it("returns isSafe: true for a strong password", async () => {
      const result = await validatePasswordSafety("Eauxle!Fragrance2024$");
      expect(result).toEqual({ isSafe: true });
    });

    it("returns isSafe: true for minimum length password (1 char)", async () => {
      const result = await validatePasswordSafety("x");
      expect(result).toEqual({ isSafe: true });
    });

    it("returns isSafe: true for exactly 128-char password", async () => {
      const result = await validatePasswordSafety("a".repeat(128));
      expect(result).toEqual({ isSafe: true });
    });

    it("returns isSafe: true for password with unicode characters", async () => {
      const result = await validatePasswordSafety("Château2024!Parfüm");
      expect(result).toEqual({ isSafe: true });
    });

    it("returns isSafe: true for password with spaces", async () => {
      const result = await validatePasswordSafety(
        "correct horse battery staple",
      );
      expect(result).toEqual({ isSafe: true });
    });
  });

  describe("common passwords", () => {
    it("returns isSafe: false for a known common password", async () => {
      // "Passw0rd" is in the COMMON_PASSWORDS list
      const result = await validatePasswordSafety("Passw0rd");
      expect(result).toEqual({ isSafe: false });
    });

    it("returns isSafe: false for another common password", async () => {
      // "Usuckballz1" is first entry in COMMON_PASSWORDS list
      const result = await validatePasswordSafety("Usuckballz1");
      expect(result).toEqual({ isSafe: false });
    });

    it("is case-sensitive: lowercase variant of common password is allowed", async () => {
      // COMMON_PASSWORDS stores "Passw0rd" (capital P) — lowercase should pass
      const result = await validatePasswordSafety("passw0rd");
      expect(result).toEqual({ isSafe: true });
    });

    it("is case-sensitive: uppercase variant of common password is allowed", async () => {
      const result = await validatePasswordSafety("PASSW0RD");
      expect(result).toEqual({ isSafe: true });
    });
  });

  describe("invalid input (schema rejection)", () => {
    it("returns isSafe: false for empty string", async () => {
      const result = await validatePasswordSafety("");
      expect(result).toEqual({ isSafe: false });
    });

    it("returns isSafe: false for password longer than 128 chars", async () => {
      const result = await validatePasswordSafety("a".repeat(129));
      expect(result).toEqual({ isSafe: false });
    });

    it("returns isSafe: false for non-string input (type coercion bypass attempt)", async () => {
      const result = await validatePasswordSafety(null as any);
      expect(result).toEqual({ isSafe: false });
    });
  });
});
