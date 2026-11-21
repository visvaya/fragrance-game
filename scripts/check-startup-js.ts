// Budget for the JavaScript the first screen of the game page loads, read from `next analyze -o`.
// Start-up files are the browser output files of every chunk group that is not async.
// Usage: next analyze --experimental-app-only -o && tsx scripts/check-startup-js.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Compressed bytes of start-up JS for `/[locale]` (measured 343681 on 2026-11-21, rounded up to the next 5 KB). */
const MAX_STARTUP_JS_BYTES = 345_000;
/** Packages that must load after start-up, through a dynamic `import()`. */
const FORBIDDEN_AT_STARTUP = ["zod", "@sentry/", "posthog-js", "@supabase/"];
const ANALYZE_PATH = ".next/diagnostics/analyze/data/[locale]/analyze.data";

/** The parts of the `analyze.data` JSON this check reads. */
export type AnalyzeData = {
  chunk_groups: { kind: string; output_file_indices: number[] }[];
  chunk_parts: { compressed_size: number; output_file_index: number; source_index: number }[];
  output_files: { filename: string }[];
  sources: { parent_source_index?: number | null; path: string }[];
};

/** Chunk parts of the browser files that load at start-up (every group except `async`). */
function startupParts(data: AnalyzeData) {
  const files = new Set<number>();
  for (const group of data.chunk_groups) {
    if (group.kind !== "async") for (const index of group.output_file_indices) files.add(index);
  }
  return data.chunk_parts.filter(
    (part) => files.has(part.output_file_index) && data.output_files[part.output_file_index]?.filename.includes("static"),
  );
}

function sourcePath(data: AnalyzeData, index: number): string {
  const source = data.sources[index];
  if (source === undefined) return "";
  const parent = source.parent_source_index;
  return parent == null ? source.path : `${sourcePath(data, parent)}/${source.path}`;
}

/**
 * Compressed size of the start-up JS and the start-up source paths inside forbidden packages.
 * @param data - Parsed `analyze.data` of one route.
 * @param forbidden - Path fragments of `node_modules` packages that must stay out of start-up.
 */
export function measureStartup(data: AnalyzeData, forbidden: readonly string[]) {
  const parts = startupParts(data);
  const forbiddenPaths = new Set<string>();
  for (const part of parts) {
    const full = sourcePath(data, part.source_index);
    if (forbidden.some((name) => full.includes(`node_modules/${name}`))) forbiddenPaths.add(full);
  }
  return { bytes: parts.reduce((sum, part) => sum + part.compressed_size, 0), forbiddenPaths: [...forbiddenPaths] };
}

/**
 * Why a start-up measurement fails the budget, or undefined when it passes.
 * @param measured - Result of `measureStartup`.
 * @param limit - Highest accepted compressed size in bytes.
 */
export function startupProblem(measured: ReturnType<typeof measureStartup>, limit: number): string | undefined {
  if (measured.forbiddenPaths.length > 0) {
    return `Start-up JS includes ${measured.forbiddenPaths.slice(0, 5).join(", ")}: load it with a dynamic import() after start-up.`;
  }
  if (measured.bytes > limit) {
    return `Start-up JS is ${measured.bytes} bytes compressed, limit ${limit}: load the new code with a dynamic import() after start-up, or raise MAX_STARTUP_JS_BYTES in scripts/check-startup-js.ts only with a recorded decision.`;
  }
  return undefined;
}

function main(): number {
  const buffer = readFileSync(ANALYZE_PATH);
  const data = JSON.parse(buffer.subarray(4, 4 + buffer.readUInt32BE(0)).toString("utf8")) as AnalyzeData;
  const measured = measureStartup(data, FORBIDDEN_AT_STARTUP);
  console.log(`Start-up JS: ${measured.bytes} bytes compressed (limit ${MAX_STARTUP_JS_BYTES}).`);
  const problem = startupProblem(measured, MAX_STARTUP_JS_BYTES);
  if (problem !== undefined) console.error(problem);
  return problem === undefined ? 0 : 1;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) process.exitCode = main();
