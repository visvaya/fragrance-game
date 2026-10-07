import { describe, expect, it } from "vitest";

import { DEFAULT_ASSETS_HOST, assetUrl, resolveAssetsHost } from "../asset-url";

describe("asset-url", () => {
  it("uses the configured host", () => {
    expect(resolveAssetsHost("img.example.com")).toBe("img.example.com");
  });

  it("falls back when the host is missing or blank", () => {
    expect(resolveAssetsHost(undefined)).toBe(DEFAULT_ASSETS_HOST);
    expect(resolveAssetsHost("  ")).toBe(DEFAULT_ASSETS_HOST);
  });

  it("builds an https URL for a key", () => {
    expect(assetUrl("a/abc/def.avif", "img.example.com")).toBe(
      "https://img.example.com/a/abc/def.avif",
    );
  });
});
