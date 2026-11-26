import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Production values live in .env.remote.local; .env.local points at the local stack.
function loadRemoteEnv(): Record<string, string> {
  try {
    const content = readFileSync(path.resolve(process.cwd(), ".env.remote.local"), "utf8");
    const entries = content.split("\n").flatMap((line): [string, string][] => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return [];
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) return [];
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replaceAll(/^['"]|['"]$/g, "");
      return [[key, val]];
    });
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

const env = loadRemoteEnv();
// A standalone script: lib/env validates the whole app environment, which this one variable does not need.
const projectId = process.env.SUPABASE_PROJECT_ID ?? env["SUPABASE_PROJECT_ID"];

if (!projectId || projectId === "-") {
  console.error(
    "Error: SUPABASE_PROJECT_ID not set. Add it to .env.remote.local:\n  SUPABASE_PROJECT_ID=your-project-id",
  );
  process.exit(1);
}

// Supabase project refs are 20 lowercase letters or digits; anything else is a typo or an injection.
if (!/^[a-z0-9]{20}$/.test(projectId)) {
  console.error("Error: SUPABASE_PROJECT_ID is not a Supabase project ref (20 lowercase letters or digits).");
  process.exit(1);
}

console.log(`Generating types for project: ${projectId}`);

// The pinned CLI from devDependencies, called without a shell.
const types = execFileSync(
  process.execPath,
  [
    path.resolve(process.cwd(), "node_modules/supabase/dist/supabase.js"),
    "gen",
    "types",
    "typescript",
    "--project-id",
    projectId,
    // Only the app's schema; extensions holds pgTAP objects while a test run is in progress.
    "--schema",
    "public",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] },
);
writeFileSync(path.resolve(process.cwd(), "types/supabase.ts"), types);

console.log("Done. types/supabase.ts updated.");
