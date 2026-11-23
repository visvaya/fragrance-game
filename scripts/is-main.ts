import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Whether the module with the URL `moduleUrl` is the script that node was started with,
 * so a script runs its work only when executed directly and not when a test imports it.
 * @param moduleUrl - `import.meta.url` of the calling module.
 * @param entryPath - `process.argv[1]`, the path of the started script.
 */
export function isMainModule(moduleUrl: string, entryPath: string | undefined): boolean {
  return entryPath !== undefined && moduleUrl === pathToFileURL(path.resolve(entryPath)).href;
}
