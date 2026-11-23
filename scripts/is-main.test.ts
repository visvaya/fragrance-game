import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { isMainModule } from "./is-main";

const scriptPath = path.resolve("scripts/example.ts");
const scriptUrl = pathToFileURL(scriptPath).href;

describe("isMainModule", () => {
  it("is true when the module is the started script", () => {
    expect(isMainModule(scriptUrl, scriptPath)).toBe(true);
  });

  it("resolves a relative entry path", () => {
    expect(isMainModule(scriptUrl, "scripts/example.ts")).toBe(true);
  });

  it("is false for another module", () => {
    expect(isMainModule(scriptUrl, path.resolve("scripts/other.ts"))).toBe(false);
  });

  it("is false without an entry path", () => {
    expect(isMainModule(scriptUrl, undefined)).toBe(false);
  });
});
