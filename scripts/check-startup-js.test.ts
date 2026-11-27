import { describe, expect, it } from "vitest";
import { type AnalyzeData, measureStartup, startupProblem } from "./check-startup-js";

// Sources: 0 = node_modules, 1 = zod (child of 0), 2 = app code. Files: 0 = start-up, 1 = async chunk, 2 = server.
const data: AnalyzeData = {
  chunk_groups: [
    { kind: "bootstrap", output_file_indices: [0, 2] },
    { kind: "async", output_file_indices: [1] },
  ],
  chunk_parts: [
    { compressed_size: 100, output_file_index: 0, source_index: 2 },
    { compressed_size: 500, output_file_index: 1, source_index: 1 },
    { compressed_size: 700, output_file_index: 2, source_index: 1 },
  ],
  output_files: [{ filename: "[output]/.next/static/chunks/a.js" }, { filename: "[output]/.next/static/chunks/b.js" }, { filename: "[output]/.next/server/c.js" }],
  sources: [{ path: "node_modules" }, { parent_source_index: 0, path: "zod/index.js" }, { path: "app/page.tsx" }],
};

describe("startup JS budget", () => {
  it("counts only browser files of non-async groups and passes a clean graph", () => {
    const measured = measureStartup(data, ["zod"]);
    expect(measured).toEqual({ bytes: 100, forbiddenPaths: [] });
    expect(startupProblem(measured, 100)).toBeUndefined();
  });

  it("fails over budget", () => {
    expect(startupProblem(measureStartup(data, []), 99)).toMatch(/100 bytes.*limit 99/);
  });

  it("fails when no start-up JS is found, so a changed analyze format cannot pass silently", () => {
    const noStartup = { ...data, chunk_groups: [{ kind: "async", output_file_indices: [0, 1] }] };
    expect(startupProblem(measureStartup(noStartup, []), 10_000)).toMatch(/No start-up JS found/);
  });

  it("finds a forbidden package when directory sources end with a slash, as next analyze writes them", () => {
    const nested: AnalyzeData = {
      ...data,
      chunk_parts: [{ compressed_size: 100, output_file_index: 0, source_index: 3 }],
      sources: [{ path: "[project]/" }, { parent_source_index: 0, path: "node_modules/" }, { parent_source_index: 1, path: "zod/" }, { parent_source_index: 2, path: "index.js" }],
    };
    expect(measureStartup(nested, ["zod"]).forbiddenPaths).toEqual(["[project]/node_modules/zod/index.js"]);
  });

  it("fails on a forbidden package in a start-up chunk", () => {
    const withZod = { ...data, chunk_groups: [{ kind: "render_dependent", output_file_indices: [0, 1] }] };
    const measured = measureStartup(withZod, ["zod"]);
    expect(measured.forbiddenPaths).toEqual(["node_modules/zod/index.js"]);
    expect(startupProblem(measured, 10_000)).toMatch(/node_modules\/zod\/index\.js.*dynamic import/);
  });
});
