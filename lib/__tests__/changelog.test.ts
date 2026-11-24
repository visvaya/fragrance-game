import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CHANGELOG, parseChangelog } from "../changelog";

const entry = {
  date: "2026-11-24",
  notes: [{ en: "A new menu", pl: "Nowe menu" }],
  version: "0.9.1",
};

describe("parseChangelog", () => {
  it("accepts a technical entry with no notes next to one with notes in both languages", () => {
    const list = [entry, { ...entry, notes: [], version: "0.9.0" }];
    expect(parseChangelog(list)).toEqual(list);
  });

  it("refuses a note missing a language", () => {
    expect(() =>
      parseChangelog([{ ...entry, notes: [{ en: "A new menu", pl: "" }] }]),
    ).toThrow(/"pl"/);
    expect(() =>
      parseChangelog([{ ...entry, notes: [{ en: "A new menu" }] }]),
    ).toThrow(/"pl"/);
  });

  it("refuses a version that is not major.minor.patch, a bad date and an empty list", () => {
    expect(() => parseChangelog([{ ...entry, version: "0.9" }])).toThrow(
      /"version"/,
    );
    expect(() => parseChangelog([{ ...entry, date: "24 Nov" }])).toThrow(
      /"date"/,
    );
    expect(() => parseChangelog([])).toThrow(/too_small/);
  });
});

describe("CHANGELOG", () => {
  it("is the parsed lib/changelog.json, newest version first and on the version in package.json", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
      version: string;
    };
    expect(CHANGELOG).toEqual(
      parseChangelog(JSON.parse(readFileSync("lib/changelog.json", "utf8"))),
    );
    expect(CHANGELOG[0]?.version).toBe(version);
  });
});
