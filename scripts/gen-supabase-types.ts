import { execSync } from "child_process";
import { readFileSync } from "fs";
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

console.log(`Generating types for project: ${projectId}`);

execSync(
  `pnpm dlx supabase gen types typescript --project-id ${projectId} > types/supabase.ts`,
  { stdio: "inherit", shell: true },
);

console.log("Done. types/supabase.ts updated.");
