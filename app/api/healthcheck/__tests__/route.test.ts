import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("GET /api/healthcheck", () => {
  it("returns HTTP 200", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("returns status ok in body", async () => {
    const response = await GET();
    const json = await response.json();

    expect(json.status).toBe("ok");
  });

  it("includes an ISO timestamp in body", async () => {
    const before = new Date().toISOString();

    const response = await GET();
    const json = await response.json();

    const after = new Date().toISOString();

    expect(typeof json.timestamp).toBe("string");
    // Timestamp must be a valid ISO string parseable back to the same value
    expect(new Date(json.timestamp as string).toISOString()).toBe(
      json.timestamp,
    );
    // Timestamp must be within the current test execution window
    expect(json.timestamp >= before).toBe(true);
    expect(json.timestamp <= after).toBe(true);
  });

  it("returns Content-Type application/json", async () => {
    const response = await GET();

    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
