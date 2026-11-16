import { describe, expect, it } from "vitest";

import { judgeFindings, parseCsv, parseFindings } from "./db-lint";

const HEADER = "name,title,level,facing,categories,description,detail,remediation,metadata,cache_key";
const row = (name: string, level: string, key: string, detail = "Detail") =>
  `${name},Title,${level},EXTERNAL,{SECURITY},"Description, with comma",${detail},https://example.test,"{""name"": ""t""}",${key}`;

describe("parseCsv", () => {
  it("reads quoted fields with commas, doubled quotes and line breaks", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });
});

describe("parseFindings", () => {
  it("maps rows to findings by header name", () => {
    const result = parseFindings(`${HEADER}\n${row("rls_disabled", "ERROR", "k1")}\n`);
    expect(result).toEqual({
      ok: true,
      value: [{ cacheKey: "k1", detail: "Detail", level: "ERROR", name: "rls_disabled" }],
    });
  });

  it("rejects output without the expected columns", () => {
    expect(parseFindings("name,level\nx,WARN\n").ok).toBe(false);
  });
});

describe("judgeFindings", () => {
  const warn = { cacheKey: "k-warn", detail: "d", level: "WARN", name: "w" };
  const info = { cacheKey: "k-info", detail: "d", level: "INFO", name: "i" };

  it("passes when every WARN or ERROR finding has an exception", () => {
    expect(judgeFindings([warn, info], { "k-warn": "reason" })).toEqual({ fresh: [], info: [info], stale: [] });
  });

  it("reports a new WARN or ERROR finding", () => {
    expect(judgeFindings([warn], {}).fresh).toEqual([warn]);
  });

  it("reports an exception whose finding is gone, so the list only shrinks", () => {
    expect(judgeFindings([], { "k-old": "reason" }).stale).toEqual(["k-old"]);
  });
});
