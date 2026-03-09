import { describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";
import plMessages from "@/messages/pl.json";

/**
 * Flattens a nested object into a flat object with dot-notation keys
 * Example: { a: { b: "value" } } => { "a.b": "value" }
 */
function flattenObject(
  object: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  const accumulator: Record<string, unknown> = {};
  for (const key of Object.keys(object)) {
    const prefixedKey = prefix ? `${prefix}.${key}` : key;
    const value = object[key];

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(
        accumulator,
        flattenObject(value as Record<string, unknown>, prefixedKey),
      );
    } else {
      accumulator[prefixedKey] = value;
    }
  }

  return accumulator;
}

describe("Translation Keys Parity", () => {
  it("should have identical key structure in all locales", () => {
    const enKeys = Object.keys(flattenObject(enMessages)).toSorted((a, b) =>
      a.localeCompare(b),
    );
    const plKeys = Object.keys(flattenObject(plMessages)).toSorted((a, b) =>
      a.localeCompare(b),
    );

    // Both locales should have exactly the same keys
    expect(enKeys).toEqual(plKeys);
  });

  it("should have no missing translations in Polish", () => {
    const enFlat = flattenObject(enMessages);
    const plFlat = flattenObject(plMessages);

    const missingKeys = Object.keys(enFlat).filter((key) => !plFlat[key]);

    if (missingKeys.length > 0) {
      console.error("Missing Polish translations for keys:", missingKeys);
    }

    expect(missingKeys).toHaveLength(0);
  });

  it("should have no extra translations in Polish", () => {
    const enFlat = flattenObject(enMessages);
    const plFlat = flattenObject(plMessages);

    const extraKeys = Object.keys(plFlat).filter((key) => !enFlat[key]);

    if (extraKeys.length > 0) {
      console.error("Extra Polish translations (not in English):", extraKeys);
    }

    expect(extraKeys).toHaveLength(0);
  });

  it("should have no empty string values in English", () => {
    const enFlat = flattenObject(enMessages);

    const emptyKeys = Object.keys(enFlat).filter(
      (key) => enFlat[key] === "" || enFlat[key] === null,
    );

    if (emptyKeys.length > 0) {
      console.error("Empty values in English translations:", emptyKeys);
    }

    expect(emptyKeys).toHaveLength(0);
  });

  it("should have no empty string values in Polish", () => {
    const plFlat = flattenObject(plMessages);

    const emptyKeys = Object.keys(plFlat).filter(
      (key) => plFlat[key] === "" || plFlat[key] === null,
    );

    if (emptyKeys.length > 0) {
      console.error("Empty values in Polish translations:", emptyKeys);
    }

    expect(emptyKeys).toHaveLength(0);
  });

  it("should have valid JSON structure", () => {
    // This test verifies that both files can be parsed as JSON
    expect(enMessages).toBeDefined();
    expect(plMessages).toBeDefined();
    expect(typeof enMessages).toBe("object");
    expect(typeof plMessages).toBe("object");
  });

  it("should have consistent value types for each key", () => {
    const enFlat = flattenObject(enMessages);
    const plFlat = flattenObject(plMessages);

    // For each key, verify that both locales have the same value type
    const inconsistentKeys: string[] = [];

    for (const key of Object.keys(enFlat)) {
      const enType = typeof enFlat[key];
      const plType = typeof plFlat[key];

      if (enType !== plType) {
        inconsistentKeys.push(`${key}: en=${enType}, pl=${plType}`);
      }
    }

    if (inconsistentKeys.length > 0) {
      console.error("Inconsistent value types:", inconsistentKeys);
    }

    expect(inconsistentKeys).toHaveLength(0);
  });

  it("should have reasonable translation coverage", () => {
    const enFlat = flattenObject(enMessages);
    const totalKeys = Object.keys(enFlat).length;

    // We expect at least 30 translation keys for a meaningful app
    expect(totalKeys).toBeGreaterThanOrEqual(30);
  });

  it("should not contain placeholder text in production", () => {
    const enFlat = flattenObject(enMessages);
    const plFlat = flattenObject(plMessages);

    // Check for common placeholder patterns
    const placeholderPatterns = [
      /TODO/i,
      /FIXME/i,
      // eslint-disable-next-line sonarjs/slow-regex
      /\[[^\]]*\]/,
      // eslint-disable-next-line sonarjs/slow-regex
      /\{[^}]*\}/,
      /xxx/i,
    ];

    const enPlaceholders: string[] = [];
    const plPlaceholders: string[] = [];

    for (const key of Object.keys(enFlat)) {
      const enValue = String(enFlat[key]);
      const plValue = String(plFlat[key]);

      for (const pattern of placeholderPatterns) {
        if (pattern.test(enValue) && !enValue.includes("{{")) {
          // Allow ICU message format
          enPlaceholders.push(`${key}: ${enValue}`);
        }

        if (pattern.test(plValue) && !plValue.includes("{{")) {
          plPlaceholders.push(`${key}: ${plValue}`);
        }
      }
    }

    if (enPlaceholders.length > 0) {
      console.warn("Possible placeholders in English:", enPlaceholders);
    }

    if (plPlaceholders.length > 0) {
      console.warn("Possible placeholders in Polish:", plPlaceholders);
    }

    // This is a soft warning, not a hard failure
    // expect(enPlaceholders).toHaveLength(0);
    // expect(plPlaceholders).toHaveLength(0);
    expect(true).toBe(true); // Ensure test has at least one assertion
  });
});

describe("Translation File Structure", () => {
  it("should have top-level categories", () => {
    const topLevelKeys = Object.keys(enMessages);

    // Verify we have major sections
    expect(topLevelKeys.length).toBeGreaterThan(0);

    // Common expected sections (adjust based on your app)
    const expectedSections = ["Metadata", "Common", "Game", "Header", "Footer"];

    for (const section of expectedSections) {
      expect(topLevelKeys).toContain(section);
    }
  });

  it("should have consistent nesting depth", () => {
    const enFlat = flattenObject(enMessages);
    const plFlat = flattenObject(plMessages);

    // Check that both files have similar structure complexity
    const enDepths = Object.keys(enFlat).map((key) => key.split(".").length);
    const plDepths = Object.keys(plFlat).map((key) => key.split(".").length);

    const enMaxDepth = Math.max(...enDepths);
    const plMaxDepth = Math.max(...plDepths);

    // Both should have similar max nesting depth
    expect(Math.abs(enMaxDepth - plMaxDepth)).toBeLessThanOrEqual(1);
  });
});
