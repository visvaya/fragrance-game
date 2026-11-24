// Fails when a file under public/ is referenced by nothing. knip follows imports only, and public/
// files are loaded by URL, so an unused one would otherwise ship unnoticed. Walks the directories
// rather than git, so an untracked file that would also ship is caught.
// Usage: tsx scripts/check-public-assets.ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { isMainModule } from "./is-main";

/** Directories and root files whose text may reference a public file. */
const REFERRER_DIRS = ["app", "components", "hooks", "i18n", "lib", "messages", "public"];
const REFERRER_FILE = /\.(?:css|html|json|mjs|ts|tsx|webmanifest)$/;
const TEST_FILE = /\.test\.tsx?|\/__tests__\//;

/** Characters that may precede a file name in a URL, an import, a CSS url() or a string. */
const NAME_BOUNDARY = new Set(["/", '"', "'", "`", "(", " ", "\t", "\n", "\r", "="]);

function mentionsName(text: string, name: string): boolean {
  // Each part but the last ends where an occurrence of the name starts.
  return text
    .split(name)
    .slice(0, -1)
    .some((before, index) => {
      const preceding = before.at(-1) ?? (index === 0 ? undefined : name.at(-1));
      return preceding === undefined || NAME_BOUNDARY.has(preceding);
    });
}

/**
 * Public files referenced by neither their path nor their file name; a file's own content does not count.
 * @param publicFiles - Paths relative to public/, with forward slashes.
 * @param referrers - Files that may reference them, with paths relative to the app (public/ files start with "public/").
 */
export function unreferencedPublicFiles(
  publicFiles: readonly string[],
  referrers: readonly { file: string; text: string }[],
): string[] {
  return publicFiles.filter((file) => {
    const name = file.slice(file.lastIndexOf("/") + 1);
    return !referrers.some(
      (referrer) =>
        referrer.file !== `public/${file}` &&
        ((file.includes("/") && referrer.text.includes(file)) || mentionsName(referrer.text, name)),
    );
  });
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(".", path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

function main(): number {
  const publicFiles = listFiles("public").map((file) => file.slice("public/".length));
  const rootFiles = readdirSync(".", { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const referrers = [...rootFiles, ...REFERRER_DIRS.flatMap((dir) => listFiles(dir))]
    .filter((file) => REFERRER_FILE.test(file) && !TEST_FILE.test(file))
    .map((file) => ({ file, text: readFileSync(file, "utf8") }));
  const unreferenced = unreferencedPublicFiles(publicFiles, referrers);
  for (const file of unreferenced) {
    console.error(`public/${file} is not referenced: remove it, or reference it from the code that serves it.`);
  }
  return unreferenced.length === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url, process.argv[1])) process.exitCode = main();
