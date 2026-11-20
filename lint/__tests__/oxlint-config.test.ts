/**
 * Wiring probe for `.oxlintrc.json`: runs the real oxlint binary on files that break each guarded
 * rule and checks that every rule reports. A JS plugin that stops loading, or an override glob that
 * stops matching, otherwise looks exactly like a clean lint run.
 */
/* eslint-disable security/detect-non-literal-fs-filename -- paths come from mkdtemp inside the repo, not from input */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = process.cwd();
const OXLINT_BIN = path.join(ROOT, "node_modules/oxlint/bin/oxlint");
const LINT_TIMEOUT_MS = 120_000;

/** Fixture path (mirrors the override globs) → the rule codes it must trigger. */
const FIXTURES: Record<string, { expected: string[]; source: string }> = {
  "app/actions/probe-action.ts": {
    expected: ["eauxle(restricted-syntax)", "eslint(no-restricted-imports)"],
    source: [
      'import { Button } from "@/components/ui/button";',
      "/** Probe. */",
      "export function probeAction(input: string) {",
      "  return [input, Button];",
      "}",
      "",
    ].join("\n"),
  },
  "app/probe/page.tsx": {
    expected: [
      "eslint(no-restricted-globals)",
      "eslint(no-restricted-imports)",
    ],
    source: [
      'import { useState } from "react";',
      "/** Probe. */",
      "export default function Page() {",
      "  const [value] = useState(window.location.href);",
      "  return <p>{value}</p>;",
      "}",
      "",
    ].join("\n"),
  },
  "components/__tests__/probe.test.tsx": {
    expected: [
      "testing-library(prefer-screen-queries)",
      "vitest(no-focused-tests)",
    ],
    source: [
      'import { render } from "@testing-library/react";',
      'import { expect, it } from "vitest";',
      'it.only("probe", () => {',
      "  const { getByText } = render(<p>x</p>);",
      '  expect(getByText("x")).toBeTruthy();',
      "});",
      "",
    ].join("\n"),
  },
  "components/game/contexts/probe-context.ts": {
    expected: ["eslint(no-restricted-imports)"],
    source: [
      'import { createClient } from "@/lib/supabase/client";',
      "/** Probe. */",
      "export const probe = createClient;",
      "",
    ].join("\n"),
  },
  "components/probe-restricted.tsx": {
    expected: [
      "eauxle(restricted-syntax)",
      "eslint(no-restricted-imports)",
      "eslint(no-restricted-properties)",
      "better-tailwindcss(no-duplicate-classes)",
      "perfectionist(sort-jsx-props)",
      "react-web-api(no-leaked-event-listener)",
    ],
    source: [
      'import { useEffect } from "react";',
      "declare const db: { from: (t: string) => { select: (c: string) => unknown } };",
      "/** Probe. */",
      "export function Probe() {",
      "  useEffect(() => {",
      '    globalThis.addEventListener("resize", () => undefined);',
      "  }, []);",
      '  db.from("t").select("*");',
      '  return <div id={String(Math.random())} className="text-[10px] p-2 p-2" aria-label="x" />;',
      "}",
      "",
    ].join("\n"),
  },
  "components/probe-server-import.tsx": {
    expected: ["eslint(no-restricted-imports)"],
    source: [
      'import { redis } from "@/lib/redis";',
      "/** Probe. */",
      "export const probe = redis;",
      "",
    ].join("\n"),
  },
  "components/ProbeName.tsx": {
    expected: ["check-file(filename-naming-convention)"],
    source: "/** Probe. */\nexport const probe = 1;\n",
  },
  "e2e/probe.spec.ts": {
    expected: [
      "playwright(no-conditional-expect)",
      "playwright(no-wait-for-timeout)",
    ],
    source: [
      'import { expect, test } from "@playwright/test";',
      'test("probe", async ({ page }) => {',
      "  await page.waitForTimeout(10);",
      "  if (page.url()) {",
      "    expect(page.url()).toBe('x');",
      "  }",
      "});",
      "",
    ].join("\n"),
  },
  "lib/probe-fetch.ts": {
    expected: ["eauxle(fetch-requires-parse)"],
    source: [
      'import { z } from "zod";',
      "const schema = z.object({});",
      "/** Parsed in the same function. */",
      "export const parsed = async (url: string) =>",
      "  schema.parse(await (await fetch(url)).json());",
      "/** Parsed in a nested callback. */",
      "export const nested = (url: string) =>",
      "  fetch(url).then((r) => schema.safeParse(r));",
      "/** Not parsed. */",
      "export const unparsed = (url: string) => fetch(url);",
      "/** Parsed in another function only. */",
      "export const elsewhere = (url: string) => fetch(url);",
      "/** Parser. */",
      "export const other = (data: unknown) => schema.parse(data);",
      "/** Unparsed axios call. */",
      "export const client = (url: string) => axios(url);",
      "export const topLevel = fetch('/x');",
      "",
    ].join("\n"),
  },
  "lib/probe-lib.ts": {
    expected: [
      "eslint(no-restricted-imports)",
      "eslint(no-restricted-properties)",
      "jsdoc-js(require-jsdoc)",
      "fp(no-mutating-methods)",
      "regexp(prefer-plus-quantifier)",
      "security(detect-child-process)",
    ],
    source: [
      'import { exec } from "node:child_process";',
      'import { useGame } from "@/hooks/use-game";',
      "export function probe(list: number[]) {",
      "  list.push(1);",
      "  exec(String(list));",
      "  return [/a{1,}/u.test(String(process.env.X)), useGame];",
      "}",
      "",
    ].join("\n"),
  },
  "lib/probe-select.ts": {
    expected: ["eauxle(bounded-select)"],
    source: [
      "declare const db: { from: (t: string) => any };",
      "export const probes = [",
      '  db.from("t").select("a").eq("b", 1),',
      '  db.from("t").select("a").eq("b", 1).limit(5),',
      '  db.from("t").select("a").single(),',
      '  db.from("t").select("a", { count: "exact", head: true }),',
      "];",
      "",
    ].join("\n"),
  },
};

/** Removes `//` and `/* *\/` comments outside strings, so that JSONC parses as JSON. */
function stripJsonComments(text: string): string {
  return text.replaceAll(
    /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//gu,
    (_match, quoted: string | undefined) => quoted ?? "",
  );
}

/** Copy of the project config pointed at the local plugin by absolute path, without type-aware lint. */
function probeConfig(): string {
  const config = JSON.parse(
    stripJsonComments(readFileSync(path.join(ROOT, ".oxlintrc.json"), "utf8")),
  ) as {
    $schema?: string;
    options: Record<string, unknown>;
    overrides: { jsPlugins?: unknown[] }[];
  };
  const localPlugin = path.join(ROOT, "lint/eauxle-plugin.mjs");
  const overrides = config.overrides.map((override) => ({
    ...override,
    ...(override.jsPlugins && {
      jsPlugins: override.jsPlugins.map((plugin) =>
        plugin === "./lint/eauxle-plugin.mjs" ? localPlugin : plugin,
      ),
    }),
  }));
  const { $schema: _schema, ...rest } = config;
  return JSON.stringify({
    ...rest,
    options: { ...config.options, typeAware: false },
    overrides,
  });
}

type Diagnostic = {
  code: string;
  filename: string;
  labels: { span: { line: number } }[];
};

describe("oxlint config wiring", () => {
  let dir = "";
  let diagnostics: Diagnostic[] = [];

  beforeAll(() => {
    // Inside the repo (git-ignored, outside node_modules), so that
    // JS plugin package names resolve from its node_modules. Files are listed explicitly, because
    // oxlint does not walk git-ignored directories.
    mkdirSync(path.join(ROOT, "test-results"), { recursive: true });
    dir = mkdtempSync(path.join(ROOT, "test-results/oxlint-probe-"));
    for (const [file, { source }] of Object.entries(FIXTURES)) {
      mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      writeFileSync(path.join(dir, file), source);
    }
    writeFileSync(path.join(dir, ".oxlintrc.json"), probeConfig());
    let output = "";
    try {
      output = execFileSync(
        process.execPath,
        [OXLINT_BIN, "-f", "json", ...Object.keys(FIXTURES)],
        {
          cwd: dir,
          encoding: "utf8",
          timeout: LINT_TIMEOUT_MS,
        },
      );
    } catch (error) {
      // oxlint exits with 1 when it reports findings; its stdout still holds the JSON.
      output = (error as { stdout: string }).stdout;
    }
    diagnostics = (JSON.parse(output) as { diagnostics: Diagnostic[] })
      .diagnostics;
  }, LINT_TIMEOUT_MS);

  afterAll(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  it.each(Object.entries(FIXTURES))(
    "%s reports every guarded rule",
    (file, { expected }) => {
      const codes = new Set(
        diagnostics
          .filter((d) => path.normalize(d.filename) === path.normalize(file))
          .map((d) => d.code),
      );
      expect([...expected].filter((code) => !codes.has(code))).toEqual([]);
    },
  );

  it("reports only the unbounded select() of lib/probe-select.ts", () => {
    const lines = diagnostics
      .filter(
        (d) =>
          d.code === "eauxle(bounded-select)" &&
          path.normalize(d.filename) === path.normalize("lib/probe-select.ts"),
      )
      .map((d) => d.labels[0]?.span.line);
    expect(lines).toEqual([3]);
  });

  it("reports fetch calls without a parse in the same function, and only those", () => {
    const lines = diagnostics
      .filter(
        (d) =>
          d.code === "eauxle(fetch-requires-parse)" &&
          path.normalize(d.filename) === path.normalize("lib/probe-fetch.ts"),
      )
      .map((d) => d.labels[0]?.span.line);
    // unparsed, elsewhere, axios and the module-scope fetch (a parse inside a function does not count)
    expect(lines).toEqual([10, 12, 16, 17]);
  });
});
