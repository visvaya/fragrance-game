// Refuses an install on a Node.js release older than the floor in package.json "engines".
// A preinstall script instead of pnpm's engineStrict: Dependabot installs with scripts off
// on an older Node, and engineStrict would fail every one of its update jobs.
import { readFileSync } from "node:fs";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === "object" && value !== null;

/** @returns {unknown} */
const readManifest = () => JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const manifest = readManifest();
const engines = isRecord(manifest) ? manifest["engines"] : undefined;
const enginesNode = isRecord(engines) && typeof engines["node"] === "string" ? engines["node"] : "";
const floor = /(\d+)\.(\d+)\.(\d+)/.exec(enginesNode);
const current = /(\d+)\.(\d+)\.(\d+)/.exec(process.version);

/**
 * @param {RegExpExecArray} match
 * @returns {number[]}
 */
const toNumbers = (match) => match.slice(1, 4).map(Number);
/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
const isOlder = (a, b) => {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
};

if (floor && current && isOlder(toNumbers(current), toNumbers(floor))) {
  console.error(
    `Node.js ${process.version} is older than ${enginesNode} from package.json. ` +
      "Install the newest release of the major line in .nvmrc and retry.",
  );
  process.exit(1);
}
