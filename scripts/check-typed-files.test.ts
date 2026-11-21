import { describe, expect, it } from "vitest";
import { untypedFileProblems } from "./check-typed-files";

const allowed = { "lint/plugin.mjs": "plugin format" };

describe("untypedFileProblems", () => {
  it("accepts TypeScript, allowlisted JavaScript and public assets", () => {
    expect(untypedFileProblems(["app/page.tsx", "lint/plugin.mjs", "public/sw.js"], allowed)).toEqual([]);
  });

  it("rejects an unlisted JavaScript file and names the fix", () => {
    const problems = untypedFileProblems(["scripts/new.mjs", "lib/old.cjs"], allowed);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/scripts\/new\.mjs.*rewrite it in TypeScript.*ALLOWED_JS/);
  });
});
