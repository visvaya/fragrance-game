// Weekly freshness check for the versioned items no dependency bot updates.
// Reads .github/freshness.json, the one list of versioned items and the mechanism that keeps each
// current, and checks every item whose mechanism is "job":
//   - a pin (file + pattern, first capture group is the version) against the newest stable release on
//     GitHub, npm or PyPI that is at least minimumReleaseAgeDays old;
//   - the Node floor: the lowest version in package.json engines.node against the newest security
//     release of the major line in .nvmrc (security releases are not held by the release age).
// Usage: node scripts/check-freshness.ts [path/to/freshness.json]   (GITHUB_TOKEN raises the API limit)
// Exit codes: 0 all current, 1 outdated item, unreadable pin or invalid list, 2 network or API failure.
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_LIST = ".github/freshness.json";
const MECHANISMS = ["dependabot", "check-latest", "job", "manual"] as const;
const SOURCES = ["github", "npm", "pypi"] as const;

type Version = readonly [number, number, number];
type Source = (typeof SOURCES)[number];
type Mechanism = (typeof MECHANISMS)[number];

/** A job check: the Node floor, or a pin read from a file and compared with one release source. */
export type JobCheck =
  | { readonly kind: "nodeFloor" }
  | { readonly file: string; readonly kind: "pin"; readonly packageName: string; readonly pattern: string; readonly source: Source };

/** One versioned item of the list after parsing. */
export type FreshnessItem =
  | { readonly check: JobCheck; readonly howToBump: string; readonly mechanism: "job"; readonly name: string }
  | { readonly mechanism: Exclude<Mechanism, "job">; readonly name: string; readonly where: string };

/** The parsed freshness list. */
export type FreshnessList = {
  readonly items: readonly FreshnessItem[];
  readonly minimumReleaseAgeDays: number;
}

/** A release as every source reports it. */
export type Release = {
  readonly publishedAt: string | undefined;
  readonly version: string | undefined;
}

/** Outcome of one checked item. */
export type ItemResult = {
  readonly name: string;
  readonly status: "ok" | "outdated" | "unreadable";
  readonly text: string;
}

type Outcome = Omit<ItemResult, "name">;

/** Reads a JSON document from a URL and parses it with the given schema. */
export type FetchJson = <T>(url: string, schema: z.ZodType<T>) => Promise<T>;

/**
 * Stable x.y.z inside a version or tag ("v1.2.3", "rust-v1.2.3"); undefined for pre-releases.
 * @param text - Version or tag text.
 */
export function parseVersion(text: string | undefined): Version | undefined {
  const match = /(?:^|[^0-9.])v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(?![0-9A-Za-z.])/.exec(` ${text ?? ""}`);
  if (match === null || match[4] !== undefined) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Orders two versions: negative when a is older, positive when newer, 0 when equal.
 * @param a - First version.
 * @param b - Second version.
 */
export function compareVersions(a: Version, b: Version): number {
  const index = a.findIndex((part, i) => part !== b[i]);
  return index === -1 ? 0 : (a[index] ?? 0) - (b[index] ?? 0);
}

const show = (version: Version): string => version.join(".");

const newest = (versions: readonly Version[]): Version | undefined => versions.toSorted(compareVersions).at(-1);

/**
 * The newest stable release published at least minAgeDays before now, or undefined.
 * @param releases - Releases of one source.
 * @param window - Current time and release age.
 * @param window.minAgeDays - Release age in days.
 * @param window.nowMs - Current time in milliseconds.
 */
export function newestEligible(
  releases: readonly Release[],
  window: { readonly minAgeDays: number; readonly nowMs: number },
): Version | undefined {
  return newest(
    releases.flatMap((release) => {
      const version = parseVersion(release.version);
      const publishedMs = Date.parse(release.publishedAt ?? "");
      return version !== undefined && window.nowMs - publishedMs >= window.minAgeDays * DAY_MS ? [version] : [];
    }),
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textField = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const isMechanism = (value: unknown): value is Mechanism => MECHANISMS.some((mechanism) => mechanism === value);

const jobCheck = (check: Record<string, unknown>): JobCheck | undefined => {
  if (check["nodeFloor"] === true) return { kind: "nodeFloor" };
  const file = textField(check, "file");
  const pattern = textField(check, "pattern");
  const sources = SOURCES.filter((key) => typeof check[key] === "string");
  const [source] = sources;
  if (file === undefined || pattern === undefined || source === undefined || sources.length !== 1) return undefined;
  return { file, kind: "pin", packageName: textField(check, source) ?? "", pattern, source };
};

type ParsedItem = {
  readonly errors: readonly string[];
  readonly item?: FreshnessItem;
}

const parseJobItem = (record: Record<string, unknown>, label: string): ParsedItem => {
  const rawCheck = isRecord(record["check"]) ? record["check"] : {};
  const check = jobCheck(rawCheck);
  const howToBump = textField(record, "howToBump");
  const isPin = typeof rawCheck["file"] === "string" && typeof rawCheck["pattern"] === "string";
  const errors = [
    ...(check === undefined ? [`${label}: a job check needs nodeFloor: true, or file, pattern and one of github, npm or pypi`] : []),
    ...(isPin && howToBump === undefined ? [`${label}: howToBump is missing`] : []),
  ];
  const name = textField(record, "name");
  return errors.length > 0 || check === undefined || name === undefined
    ? { errors }
    : { errors, item: { check, howToBump: howToBump ?? "", mechanism: "job", name } };
};

const parseItem = (raw: unknown, index: number): ParsedItem => {
  const record = isRecord(raw) ? raw : {};
  const name = textField(record, "name");
  const label = name ?? `item ${index + 1}`;
  const mechanism = record["mechanism"];
  const where = textField(record, "where");
  const errors = [
    ...(name === undefined ? [`${label}: name is missing`] : []),
    ...(isMechanism(mechanism) ? [] : [`${label}: mechanism must be one of ${MECHANISMS.join(", ")}`]),
    ...(mechanism !== "job" && where === undefined ? [`${label}: where must say which configuration keeps it current`] : []),
  ];
  if (mechanism === "job") {
    const job = parseJobItem(record, label);
    return { ...job, errors: [...errors, ...job.errors] };
  }
  return errors.length > 0 || !isMechanism(mechanism) || mechanism === "job" || name === undefined || where === undefined
    ? { errors }
    : { errors, item: { mechanism, name, where } };
};

/**
 * Parses the list at the boundary.
 * @param raw - The parsed JSON of the freshness list.
 */
export function parseList(raw: unknown): { error: readonly string[]; ok: false } | { ok: true; value: FreshnessList } {
  const record = isRecord(raw) ? raw : {};
  const minimumReleaseAgeDays = record["minimumReleaseAgeDays"] ?? 7;
  const validAge = typeof minimumReleaseAgeDays === "number" && Number.isInteger(minimumReleaseAgeDays) && minimumReleaseAgeDays >= 0;
  const rawItems: readonly unknown[] = Array.isArray(record["items"]) ? (record["items"] as unknown[]) : [];
  const parsed = rawItems.map((item, index) => parseItem(item, index));
  const errors = [
    ...(validAge ? [] : ["minimumReleaseAgeDays must be a whole number of days"]),
    ...(rawItems.length === 0 ? ["items must list every versioned item of the project"] : []),
    ...parsed.flatMap((result) => result.errors),
  ];
  const items = parsed.flatMap((result) => (result.item === undefined ? [] : [result.item]));
  return errors.length > 0 || typeof minimumReleaseAgeDays !== "number"
    ? { error: errors, ok: false }
    : { ok: true, value: { items, minimumReleaseAgeDays } };
}

/**
 * The pinned version of a job item, or undefined when the pattern no longer matches.
 * @param text - Content of the file that holds the pin.
 * @param pattern - Regular expression from the repository's own list; its first capture group is the version.
 */
export function readPin(text: string, pattern: string): Version | undefined {
  return parseVersion(new RegExp(pattern, "m").exec(text)?.[1]);
}

/**
 * The lowest version a range admits ("^26.12.1", ">=26.12.1 <27", "^24.12.0 || ^26.12.1"): within one
 * || branch every comparator must hold, so its floor is the highest lower bound; across branches the lowest
 * floor wins. Upper bounds (<, <=) do not limit it, and a hyphen range ("26.12.1 - 26.14.0") starts at its
 * first end. Undefined when no full version is given.
 * @param range - The engines.node range.
 */
export function engineFloor(range: string | undefined): Version | undefined {
  const floors = (range ?? "").split("||").flatMap((branch) => {
    const lowerBounds = branch
      .replace(/ - .*$/, "")
      .replaceAll(/([<>]=?) +/g, "$1")
      .split(" ")
      .filter((part) => part !== "" && !part.startsWith("<"))
      .flatMap((part) => {
        const version = parseVersion(part);
        return version === undefined ? [] : [version];
      });
    const floor = newest(lowerBounds);
    return floor === undefined ? [] : [floor];
  });
  return floors.toSorted(compareVersions)[0];
}

const NodeIndexSchema = z.array(z.object({ security: z.boolean().optional(), version: z.string() }));

/**
 * Outcome of the Node floor check.
 * @param input - What the check reads.
 * @param input.engines - The engines.node range.
 * @param input.index - The nodejs.org release index.
 * @param input.nvmrc - Content of .nvmrc.
 */
export function nodeFloorResult(input: {
  readonly engines: string | undefined;
  readonly index: z.infer<typeof NodeIndexSchema>;
  readonly nvmrc: string | undefined;
}): Outcome {
  const { engines } = input;
  const major = Number(/^ *v?(\d+)/.exec(input.nvmrc ?? "")?.[1]);
  const floor = engineFloor(engines);
  if (!Number.isInteger(major) || floor === undefined || engines === undefined) {
    return { status: "unreadable", text: "needs a major line in .nvmrc and a full version in package.json engines.node" };
  }
  const newestSecurity = newest(
    input.index.flatMap((entry) => {
      const version = entry.security === true ? parseVersion(entry.version) : undefined;
      return version?.[0] === major ? [version] : [];
    }),
  );
  if (newestSecurity === undefined) return { status: "ok", text: `floor ${show(floor)}, no security release of Node ${major} yet` };
  // The suggestion keeps the project's operator: a preinstall check may accept only one form.
  const operator = /^ *(\^|~|>=)/.exec(engines)?.[1] ?? ">=";
  return compareVersions(floor, newestSecurity) < 0
    ? {
        status: "outdated",
        text:
          `floor ${show(floor)} is below the security release ${show(newestSecurity)}: set engines.node to ` +
          `${operator}${show(newestSecurity)} (the preinstall check refuses older Node), install it locally, then run the gate`,
      }
    : { status: "ok", text: `floor ${show(floor)}, newest security release ${show(newestSecurity)}` };
}

/**
 * Outcome of a pin against the newest eligible release.
 * @param input - The pin and the newest release.
 * @param input.howToBump - What to do when the pin is behind.
 * @param input.minAgeDays - Release age in days.
 * @param input.newest - Newest eligible release.
 * @param input.pinned - Version read from the pin.
 */
export function pinResult(input: {
  readonly howToBump: string;
  readonly minAgeDays: number;
  readonly newest: Version | undefined;
  readonly pinned: Version | undefined;
}): Outcome {
  const { newest: latest, pinned } = input;
  if (pinned === undefined) return { status: "unreadable", text: "pin not found: fix file or pattern in the freshness list" };
  if (latest === undefined) return { status: "ok", text: `pinned ${show(pinned)}, no release older than ${input.minAgeDays} days` };
  return compareVersions(latest, pinned) > 0
    ? { status: "outdated", text: `pinned ${show(pinned)}, latest ${show(latest)}: ${input.howToBump}` }
    : { status: "ok", text: `pinned ${show(pinned)}, latest ${show(latest)}` };
}

/**
 * The printed report and the exit code for all items.
 * @param results - Outcomes of the checked items.
 */
export function formatReport(results: readonly ItemResult[]): { exitCode: number; text: string } {
  const lines = results.map(
    (result) => `${result.name}: ${result.status === "ok" ? "" : `${result.status.toUpperCase()}, `}${result.text}`,
  );
  return { exitCode: results.some((result) => result.status !== "ok") ? 1 : 0, text: `${lines.join("\n")}\n` };
}

const GithubReleasesSchema = z.array(
  z.object({
    draft: z.boolean().optional(),
    prerelease: z.boolean().optional(),
    published_at: z.string().nullable(),
    tag_name: z.string(),
  }),
);
const PypiSchema = z.object({
  releases: z.record(z.string(), z.array(z.object({ upload_time_iso_8601: z.string(), yanked: z.boolean().optional() }))).optional(),
});
const NpmSchema = z.object({
  time: z.record(z.string(), z.string()).optional(),
  versions: z.record(z.string(), z.unknown()).optional(),
});

const RELEASE_SOURCES: Readonly<Record<Source, (fetchJson: FetchJson, name: string) => Promise<Release[]>>> = {
  github: async (fetchJson, repo) => {
    const releases = await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=100`, GithubReleasesSchema);
    return releases
      .filter((release) => release.draft !== true && release.prerelease !== true)
      .map((release) => ({ publishedAt: release.published_at ?? undefined, version: release.tag_name }));
  },
  npm: async (fetchJson, name) => {
    const doc = await fetchJson(`https://registry.npmjs.org/${name.replaceAll("/", "%2F")}`, NpmSchema);
    return Object.keys(doc.versions ?? {}).map((version) => ({ publishedAt: doc.time?.[version], version }));
  },
  pypi: async (fetchJson, name) => {
    const doc = await fetchJson(`https://pypi.org/pypi/${name}/json`, PypiSchema);
    return Object.entries(doc.releases ?? {})
      .filter(([, files]) => files.length > 0 && files.every((file) => file.yanked !== true))
      .map(([version, files]) => ({ publishedAt: files[0]?.upload_time_iso_8601, version }));
  },
};

const isMissingFile = (error: unknown): boolean => isRecord(error) && error["code"] === "ENOENT";

// The Node line from .nvmrc, or from .node-version where a project keeps it there.
const runtimeLine = (readText: (file: string) => string): string => {
  try {
    return readText(".nvmrc");
  } catch (error) {
    if (!isMissingFile(error)) throw error;
    return readText(".node-version");
  }
};

const PackageJsonSchema = z.object({ engines: z.object({ node: z.string().optional() }).optional() });

const checkItem = async (
  item: Extract<FreshnessItem, { mechanism: "job" }>,
  io: { readonly fetchJson: FetchJson; readonly minAgeDays: number; readonly nowMs: number; readonly readText: (file: string) => string },
): Promise<ItemResult> => {
  const { check } = item;
  if (check.kind === "nodeFloor") {
    const engines = PackageJsonSchema.parse(JSON.parse(io.readText("package.json"))).engines?.node;
    const index = await io.fetchJson("https://nodejs.org/dist/index.json", NodeIndexSchema);
    return { name: item.name, ...nodeFloorResult({ engines, index, nvmrc: runtimeLine(io.readText) }) };
  }
  const pinned = readPin(io.readText(check.file), check.pattern);
  const releases = await RELEASE_SOURCES[check.source](io.fetchJson, check.packageName);
  const latest = newestEligible(releases, { minAgeDays: io.minAgeDays, nowMs: io.nowMs });
  return { name: item.name, ...pinResult({ howToBump: item.howToBump, minAgeDays: io.minAgeDays, newest: latest, pinned }) };
};

/**
 * Checks every job item; I/O comes in as parameters so tests run without a network.
 * @param input - The list and the effects.
 * @param input.fetchJson - Reads and parses a JSON document.
 * @param input.list - The parsed freshness list.
 * @param input.nowMs - Current time in milliseconds.
 * @param input.readText - Reads a file of the repository.
 */
export async function checkItems(input: {
  readonly fetchJson: FetchJson;
  readonly list: FreshnessList;
  readonly nowMs: number;
  readonly readText: (file: string) => string;
}): Promise<ItemResult[]> {
  const io = { ...input, minAgeDays: input.list.minimumReleaseAgeDays };
  return Promise.all(input.list.items.flatMap((item) => (item.mechanism === "job" ? [checkItem(item, io)] : [])));
}

const fetchJsonWith =
  (token: string | undefined): FetchJson =>
  async (url, schema) => {
    const github = url.startsWith("https://api.github.com/");
    // The answer is parsed below with the schema the caller passes.
    // eslint-disable-next-line eauxle/restricted-syntax -- parse happens on response.json(), not inside fetch()
    const response = await fetch(url, {
      headers: {
        accept: github ? "application/vnd.github+json" : "application/json",
        "user-agent": "freshness-check",
        ...(github && token !== undefined && token !== "" ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${response.status} from ${url}`);
    return schema.parse(await response.json());
  };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const readList = (root: string, listPath: string): ReturnType<typeof parseList> => {
  try {
    return parseList(JSON.parse(readFileSync(path.resolve(root, listPath), "utf8")));
  } catch (error) {
    return { error: [`${listPath}: ${messageOf(error)}`], ok: false };
  }
};

async function main(): Promise<number> {
  const root = process.cwd();
  const listPath = process.argv[2] ?? DEFAULT_LIST;
  const list = readList(root, listPath);
  if (!list.ok) {
    process.stderr.write(`${list.error.join("\n")}\n`);
    return 1;
  }
  try {
    const results = await checkItems({
      fetchJson: fetchJsonWith(process.env["GITHUB_TOKEN"]),
      list: list.value,
      nowMs: Date.now(),
      readText: (file) => readFileSync(path.join(root, file), "utf8"),
    });
    const report = formatReport(results);
    process.stdout.write(report.text);
    return report.exitCode;
  } catch (error) {
    process.stderr.write(`${messageOf(error)}\n`);
    return error instanceof SyntaxError || error instanceof z.ZodError || isMissingFile(error) ? 1 : 2;
  }
}

// Compared through realpath: Node reports a symlinked or junctioned script by its real path.
const isEntry = (): boolean => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? "")).href;
  } catch {
    return false;
  }
};
// Run with node itself, not tsx: Node strips the types and loads the file as an ES module (it
// imports), which allows the top-level await; tsx would compile it to CommonJS and reject it.
if (isEntry()) process.exitCode = await main();
