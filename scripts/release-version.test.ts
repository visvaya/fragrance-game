import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseChangelog, type ChangelogEntry } from "../lib/changelog";
import {
  CHANGELOG_FILE,
  bumpOfTitle,
  compareVersions,
  expectedVersion,
  nextChangelog,
  nextVersion,
  shipsTheApp,
  versionProblems,
  withVersion,
} from "./release-version";

const pkg = (version: string, extra: Record<string, unknown> = {}) => ({ version, ...extra });
const note = { en: "A new menu", pl: "Nowe menu" };

describe("bumpOfTitle", () => {
  it("takes the middle number for feat, the last for any other type, the first for a breaking change", () => {
    expect(bumpOfTitle("feat(game): add a hint")).toBe("minor");
    expect(bumpOfTitle("fix(ui): align the logo")).toBe("patch");
    expect(bumpOfTitle("build(deps): bump zod")).toBe("patch");
    expect(bumpOfTitle("fix!: change the save format")).toBe("major");
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

describe("compareVersions", () => {
  it("compares numbers, not text", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("0.9.9", "0.10.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
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
  const entry = (version: string, notes = [note]) => ({ date: "2026-11-24", notes, version });
  const problems = (title: string, changedPaths: string[], head: string, changelog = [entry(head)]) =>
    versionProblems({ basePackage: base, changedPaths, headChangelog: changelog, headPackage: pkg(head), title });

  it("accepts the step the title names", () => {
    expect(problems("fix(ui): x", ["app/page.tsx"], "0.9.1", [entry("0.9.1", [])])).toEqual([]);
    expect(problems("feat(game): x", ["app/page.tsx"], "0.10.0")).toEqual([]);
  });

  it("accepts an unchanged version when nothing ships", () => {
    expect(problems("docs: x", ["README.md"], "0.9.0", [entry("0.9.0", [])])).toEqual([]);
  });

  it("names the missing bump and the command that sets it", () => {
    const [problem] = problems("fix(ui): x", ["app/page.tsx"], "0.9.0");
    expect(problem).toMatch(/must say 0\.9\.1, not 0\.9\.0/);
    expect(problem).toMatch(/version:bump/);
  });

  it("refuses a bump when nothing ships", () => {
    expect(problems("ci: x", [".github/workflows/ci.yml"], "0.9.1")[0]).toMatch(/must say 0\.9\.0, not 0\.9\.1/);
  });

  it("refuses a feature without notes for the players", () => {
    const [problem] = problems("feat(game): x", ["app/page.tsx"], "0.10.0", [entry("0.10.0", [])]);
    expect(problem).toMatch(/needs notes/);
    expect(problem).toContain(CHANGELOG_FILE);
  });
});

describe("nextChangelog", () => {
  const published: ChangelogEntry[] = [{ date: "2026-09-27", notes: [], version: "0.9.0" }];
  const move = (entries: ChangelogEntry[], version: string) =>
    nextChangelog(entries, { baseVersion: "0.9.0", date: "2026-11-24", version });

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
