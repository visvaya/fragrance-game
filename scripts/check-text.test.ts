import { describe, expect, it } from "vitest";

import { addedLines, commitMessageProblems, forbiddenIn } from "./check-text";

const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);
const ROCKET = String.fromCodePoint(0x1f680);
const TRADE_MARK = String.fromCodePoint(0x2122);

describe("forbiddenIn", () => {
  it("finds em dashes and emoji", () => {
    expect(forbiddenIn(`a ${EM_DASH} b`)).toHaveLength(1);
    expect(forbiddenIn(`launch ${ROCKET}`)).toEqual(["emoji"]);
  });

  it("allows en dashes and the trade mark sign", () => {
    expect(forbiddenIn(`2010${EN_DASH}2012 Ambroxan${TRADE_MARK}`)).toEqual([]);
  });
});

describe("addedLines", () => {
  it("returns added lines with their new numbers, skipping deleted files and lockfiles", () => {
    const diff = [
      "diff --git a/app/page.tsx b/app/page.tsx",
      "--- a/app/page.tsx",
      "+++ b/app/page.tsx",
      "@@ -3,0 +4,2 @@ export",
      "+first",
      "+second",
      "@@ -10 +12 @@",
      "-old",
      "+new",
      "--- a/gone.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-removed",
      "--- a/pnpm-lock.yaml",
      "+++ b/pnpm-lock.yaml",
      "@@ -1 +1 @@",
      "+lock",
    ].join("\n");
    expect(addedLines(diff)).toEqual([
      { file: "app/page.tsx", line: 4, text: "first" },
      { file: "app/page.tsx", line: 5, text: "second" },
      { file: "app/page.tsx", line: 12, text: "new" },
    ]);
  });
});

describe("commitMessageProblems", () => {
  it("accepts a plain message", () => {
    expect(commitMessageProblems("feat(game): add a hint\n\nBody text.\n")).toEqual([]);
  });

  it("rejects attribution lines in any letter case", () => {
    expect(commitMessageProblems("fix: x\n\nCo-Authored-By: Someone <a@b.c>\n")).toHaveLength(1);
    expect(commitMessageProblems("fix: x\n\nGenerated with some tool\n")).toHaveLength(1);
    expect(commitMessageProblems("fix: x\n\nTool-Session: abc\n")).toHaveLength(1);
  });

  it("rejects em dashes and emoji but ignores comments and the diff below the scissors", () => {
    expect(commitMessageProblems(`fix: a ${EM_DASH} b\n`)).toHaveLength(1);
    expect(
      commitMessageProblems(
        `fix: x\n# Co-authored-by: in a comment ${EM_DASH}\n# ------------------------ >8 ------------------------\n+${ROCKET}\n`,
      ),
    ).toEqual([]);
  });
});
