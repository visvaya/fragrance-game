// Refuses an install on a Node.js release older than the floor in package.json "engines".
// A preinstall script instead of pnpm's engineStrict: Dependabot installs with scripts off
// on an older Node, and engineStrict would fail every one of its update jobs.
import { readFileSync } from "node:fs";

const { engines } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const floor = /(\d+)\.(\d+)\.(\d+)/.exec(engines?.node ?? "");
const current = /(\d+)\.(\d+)\.(\d+)/.exec(process.version);

const toNumbers = (match) => match.slice(1, 4).map(Number);
const isOlder = (a, b) => {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
};

if (floor && current && isOlder(toNumbers(current), toNumbers(floor))) {
  console.error(
    `Node.js ${process.version} is older than ${engines.node} from package.json. ` +
      "Install the newest release of the major line in .nvmrc and retry.",
  );
  process.exit(1);
}
