import { execFileSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal(): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnvLocal();
const projectId = process.env.SUPABASE_PROJECT_ID ?? env["SUPABASE_PROJECT_ID"];

if (!projectId || projectId === "-") {
  console.error(
    "Error: SUPABASE_PROJECT_ID not set. Add it to .env.local:\n  SUPABASE_PROJECT_ID=your-project-id",
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
    resolve(process.cwd(), "node_modules/supabase/dist/supabase.js"),
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
writeFileSync(resolve(process.cwd(), "types/supabase.ts"), types);

console.log("Done. types/supabase.ts updated.");
