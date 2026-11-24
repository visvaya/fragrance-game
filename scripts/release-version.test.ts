import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseChangelog, type ChangelogEntry } from "../lib/changelog";
import {
  CHANGELOG_FILE,
  bumpOfTitle,
  expectedVersion,
  nextChangelog,
  nextVersion,
  parsePackage,
  shipsTheApp,
  versionProblems,
  withVersion,
} from "./release-version";

const pkg = (version: string, extra: Record<string, unknown> = {}) => ({ version, ...extra });
const compareVersions = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
const note = { en: "A new menu", pl: "Nowe menu" };

describe("bumpOfTitle", () => {
  it("takes the middle number for feat, the last for any other type, the first for a breaking change", () => {
    expect(bumpOfTitle("feat(game): add a hint")).toBe("minor");
    expect(bumpOfTitle("fix(ui): align the logo")).toBe("patch");
    expect(bumpOfTitle("build(deps): bump zod")).toBe("patch");
    expect(bumpOfTitle("fix!: change the save format")).toBe("major");
    expect(bumpOfTitle("feat!: drop the old save format")).toBe("major");
    expect(bumpOfTitle("feat(game)!: rebuild the scoring")).toBe("major");
  });

  it("refuses a title that is not a Conventional Commit", () => {
    expect(() => bumpOfTitle("Update stuff")).toThrow(/Conventional/);
  });
});

describe("nextVersion", () => {
  it("steps the number and zeroes the ones after it", () => {
    expect(nextVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(nextVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(nextVersion("1.2.3", "major")).toBe("2.0.0");
  });

  it("keeps the first number at 0 before 1.0: a breaking change moves the middle one", () => {
    expect(nextVersion("0.9.4", "major")).toBe("0.10.0");
  });

  it("refuses a text that is not a version", () => {
    expect(() => nextVersion("0.9", "patch")).toThrow(/not a version/);
  });
});

describe("shipsTheApp", () => {
  const same = pkg("0.9.0");

  it("counts source, messages, public files, the lockfile and the framework config", () => {
    for (const path of [
      "app/page.tsx",
      "components/game/board.tsx",
      "lib/game/scoring.ts",
      "messages/pl.json",
      "public/logo.svg",
      "proxy.ts",
      "next.config.ts",
      "pnpm-lock.yaml",
      CHANGELOG_FILE,
    ]) {
      expect(shipsTheApp([path], same, same)).toBe(true);
    }
  });

  it("ignores tests, docs, CI, scripts and the database", () => {
    const paths = [
      "lib/game/__tests__/scoring.test.ts",
      "lib/sentry-scrub.test.ts",
      "e2e/smoke.spec.ts",
      "README.md",
      ".github/workflows/ci.yml",
      "scripts/etl.py",
      "supabase/migrations/20261124_x.sql",
    ];
    expect(shipsTheApp(paths, same, same)).toBe(false);
  });

  it("counts package.json unless only the version or a script other than build moved", () => {
    const base = pkg("0.9.0", { scripts: { build: "next build", lint: "oxlint" } });
    expect(shipsTheApp(["package.json"], base, { ...base, version: "0.9.1" })).toBe(false);
    expect(shipsTheApp(["package.json"], base, { ...base, scripts: { build: "next build", lint: "x" } })).toBe(false);
    expect(shipsTheApp(["package.json"], base, { ...base, scripts: { build: "next build --turbo", lint: "oxlint" } })).toBe(true);
    expect(shipsTheApp(["package.json"], base, { ...base, dependencies: { zod: "4.0.0" } })).toBe(true);
  });
});

describe("expectedVersion", () => {
  it("is the next version for a change that ships and the base one otherwise", () => {
    const base = pkg("0.9.0");
    expect(expectedVersion({ basePackage: base, changedPaths: ["app/page.tsx"], headPackage: base, title: "feat: x" })).toBe("0.10.0");
    expect(expectedVersion({ basePackage: base, changedPaths: [".github/workflows/ci.yml"], headPackage: base, title: "ci: x" })).toBe("0.9.0");
  });
});

describe("versionProblems", () => {
  const base = pkg("0.9.0");
  const entry = (version: string, notes = [note]): ChangelogEntry => ({ date: "2026-11-24", notes, version });
  const baseChangelog = [entry("0.9.0", [])];
  // The change list of a pull request that moves to `head`: the base's list with a new entry on top.
  const problems = (title: string, changedPaths: string[], head: string, notes = [note]) =>
    versionProblems({
      baseChangelog,
      basePackage: base,
      changedPaths,
      headChangelog: head === "0.9.0" ? baseChangelog : [entry(head, notes), ...baseChangelog],
      headPackage: pkg(head),
      title,
    });

  it("accepts the step the title names", () => {
    expect(problems("fix(ui): x", ["app/page.tsx"], "0.9.1", [])).toBeUndefined();
    expect(problems("feat(game): x", ["app/page.tsx"], "0.10.0")).toBeUndefined();
  });

  it("accepts an unchanged version when nothing ships", () => {
    expect(problems("docs: x", ["README.md"], "0.9.0")).toBeUndefined();
  });

  it("names the missing bump and what to run", () => {
    const problem = problems("fix(ui): x", ["app/page.tsx"], "0.9.0");
    expect(problem).toMatch(/must say 0\.9\.1, not 0\.9\.0/);
    expect(problem).toMatch(/update the branch from main, then run .*version:bump/);
  });

  it("refuses a bump when nothing ships", () => {
    expect(problems("ci: x", [".github/workflows/ci.yml"], "0.9.1")).toMatch(/must say 0\.9\.0, not 0\.9\.1/);
  });

  it("refuses a feature or a breaking change without notes for the players", () => {
    for (const title of ["feat(game): x", "feat!: x", "fix(game)!: x"]) {
      const problem = problems(title, ["app/page.tsx"], "0.10.0", []);
      expect(problem).toMatch(/needs notes/);
      expect(problem).toContain(CHANGELOG_FILE);
    }
  });

  it("refuses a change list that lost or doubled a published entry", () => {
    const check = (headChangelog: ChangelogEntry[]) =>
      versionProblems({
        baseChangelog,
        basePackage: base,
        changedPaths: ["app/page.tsx"],
        headChangelog,
        headPackage: pkg("0.9.1"),
        title: "fix(ui): x",
      });
    expect(check([entry("0.9.1", [])])).toMatch(/must be the base's list/);
    expect(check([entry("0.9.1", []), entry("0.9.1", []), ...baseChangelog])).toMatch(/must be the base's list/);
    expect(check([entry("0.9.2", []), ...baseChangelog])).toMatch(/must be the base's list/);
  });
});

describe("nextChangelog", () => {
  const published: ChangelogEntry[] = [{ date: "2026-09-27", notes: [], version: "0.9.0" }];
  const move = (head: ChangelogEntry[], version: string, base = published) =>
    nextChangelog(head, base, { date: "2026-11-24", version });

  it("adds a technical entry for a new version", () => {
    expect(move(published, "0.9.1")).toEqual([{ date: "2026-11-24", notes: [], version: "0.9.1" }, ...published]);
  });

  it("renumbers the branch's own entry and keeps its notes", () => {
    const own = [{ date: "2026-11-20", notes: [note], version: "0.9.1" }, ...published];
    expect(move(own, "0.10.0")).toEqual([{ date: "2026-11-24", notes: [note], version: "0.10.0" }, ...published]);
  });

  it("drops the branch's own entry when the version goes back to the base one", () => {
    const own = [{ date: "2026-11-20", notes: [], version: "0.9.1" }, ...published];
    expect(move(own, "0.9.0")).toEqual(published);
  });

  it("leaves the published entries alone when nothing moves", () => {
    expect(move(published, "0.9.0")).toEqual(published);
  });

  it("keeps every published entry when a revert restores an older version", () => {
    const base: ChangelogEntry[] = [
      { date: "2026-11-23", notes: [note], version: "0.9.2" },
      { date: "2026-11-22", notes: [], version: "0.9.1" },
      ...published,
    ];
    expect(move(base.slice(1), "0.9.3", base)).toEqual([{ date: "2026-11-24", notes: [], version: "0.9.3" }, ...base]);
  });

  it("finds the branch's own entry when an update from main left both entries of the same version", () => {
    const main: ChangelogEntry = { date: "2026-11-23", notes: [], version: "0.9.1" };
    const own: ChangelogEntry = { date: "2026-11-22", notes: [note], version: "0.9.1" };
    expect(move([own, main, ...published], "0.9.2", [main, ...published])).toEqual([
      { date: "2026-11-24", notes: [note], version: "0.9.2" },
      main,
      ...published,
    ]);
  });
});

describe("parsePackage", () => {
  it("keeps the other fields and refuses a missing or malformed version", () => {
    expect(parsePackage({ name: "x", version: "0.9.0" })).toEqual({ name: "x", version: "0.9.0" });
    expect(() => parsePackage({ name: "x" })).toThrow(/version/);
    expect(() => parsePackage({ version: "0.9" })).toThrow(/version/);
  });
});

describe("withVersion", () => {
  it("replaces only the version field and keeps the rest of the text", () => {
    const text = '{\n  "name": "x",\n  "version": "0.9.0",\n  "scripts": { "v": "node -v" }\n}\n';
    expect(withVersion(text, "0.9.1")).toBe(text.replace("0.9.0", "0.9.1"));
  });
});

describe("the repository's version sources", () => {
  const packageVersion = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
  const changelog = parseChangelog(JSON.parse(readFileSync(CHANGELOG_FILE, "utf8")));

  it("keeps the newest changelog entry on the version in package.json (pnpm version:bump sets both)", () => {
    expect(changelog[0]?.version).toBe(packageVersion);
  });

  it("lists versions from the newest to the oldest, each once", () => {
    for (const [index, older] of changelog.slice(1).entries()) {
      expect(compareVersions(changelog[index]?.version ?? "", older.version)).toBeGreaterThan(0);
    }
  });
});
