import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Guards against drift between the Zod schema in lib/env.ts and the documented
 * .env.example. Without this, a newly required variable silently breaks every
 * fresh checkout: the app throws at startup and .env.example never mentions it.
 */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Variables Node or the platform always provides — never documented as user input. */
const PLATFORM_PROVIDED = new Set(["NODE_ENV"]);

/** Reads a repo-relative file as an array of lines. */
function readLines(...segments: readonly string[]): readonly string[] {
  // FILESYSTEM: path is built from import.meta.url and literal segments — not user input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFileSync(path.join(REPO_ROOT, ...segments), "utf8").split("\n");
}

/** Extracts the keys declared in the `runtimeEnv` block of lib/env.ts. */
function readRuntimeEnvironmentKeys(): readonly string[] {
  const lines = readLines("lib", "env.ts");
  const start = lines.findIndex((line) => line.includes("runtimeEnv: {"));

  if (start === -1) {
    throw new Error("Could not locate the runtimeEnv block in lib/env.ts");
  }

  const offset = lines.findIndex(
    (line, index) => index > start && line === "  },",
  );
  const end = offset === -1 ? lines.length : offset;

  return lines
    .slice(start + 1, end)
    .map((line) => /^ {4}([A-Z\d_]+):/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1]);
}

/** Extracts the variable names assigned in .env.example, ignoring comments. */
function readExampleKeys(): readonly string[] {
  return readLines(".env.example")
    .map((line) => /^([A-Z\d_]+)=/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1]);
}

describe("lib/env.ts and .env.example stay in sync", () => {
  it("documents every variable the schema reads", () => {
    const documented = new Set(readExampleKeys());
    const undocumented = readRuntimeEnvironmentKeys().filter(
      (key) => !PLATFORM_PROVIDED.has(key) && !documented.has(key),
    );

    expect(undocumented).toEqual([]);
  });

  it("declares each variable in .env.example exactly once", () => {
    const keys = readExampleKeys();
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);

    expect(duplicates).toEqual([]);
  });

  it("finds a non-empty schema to compare against", () => {
    expect(readRuntimeEnvironmentKeys().length).toBeGreaterThan(5);
    expect(readExampleKeys().length).toBeGreaterThan(5);
  });
});
