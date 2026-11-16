import { describe, expect, it } from "vitest";

import { compareFingerprint, parseQueryOutput } from "./db-fingerprint";

const output = (lines: string[]) =>
  JSON.stringify({ boundary: "x", rows: lines.map((fingerprint) => ({ fingerprint })) });

describe("parseQueryOutput", () => {
  it("returns the fingerprint lines in order", () => {
    expect(parseQueryOutput(output(["01 a", "02 b"]))).toEqual({ ok: true, value: ["01 a", "02 b"] });
  });

  it("rejects output without fingerprint rows", () => {
    expect(parseQueryOutput(JSON.stringify({ rows: [{ other: 1 }] })).ok).toBe(false);
    expect(parseQueryOutput("not json").ok).toBe(false);
  });
});

describe("compareFingerprint", () => {
  const expected = "01 a\n02 b\n";

  it("accepts identical lines, ignoring the final newline and CRLF", () => {
    expect(compareFingerprint(["01 a", "02 b"], expected)).toEqual({ ok: true });
    expect(compareFingerprint(["01 a", "02 b"], "01 a\r\n02 b\r\n")).toEqual({ ok: true });
  });

  it("reports lines missing from production and lines production has extra", () => {
    expect(compareFingerprint(["01 a", "03 c"], expected)).toEqual({
      ok: false,
      missing: ["02 b"],
      extra: ["03 c"],
    });
  });

  it("reports a change of order as a difference", () => {
    expect(compareFingerprint(["02 b", "01 a"], expected)).toEqual({ ok: false, missing: [], extra: [] });
  });
});
