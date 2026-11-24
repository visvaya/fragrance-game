import { describe, expect, it } from "vitest";

import { assetUrl, resolveAssetsHost } from "../asset-url";

describe("asset-url", () => {
  it("uses the configured host", () => {
    expect(resolveAssetsHost("img.example.com")).toBe("img.example.com");
  });

  it("trims whitespace around the host", () => {
    expect(resolveAssetsHost("  img.example.com ")).toBe("img.example.com");
  });

  it("builds an https URL for a key", () => {
    expect(assetUrl("a/abc/def.avif", "img.example.com")).toBe(
      "https://img.example.com/a/abc/def.avif",
    );
  });
});
