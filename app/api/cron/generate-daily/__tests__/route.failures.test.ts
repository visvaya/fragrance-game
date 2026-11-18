import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureException, queries, resolveQuery, revalidateTag } = vi.hoisted(
  () => ({
    captureException: vi.fn(),
    queries: [] as { calls: unknown[][]; table: string }[],
    resolveQuery: vi.fn(),
    revalidateTag: vi.fn(),
  }),
);

vi.mock("@/lib/env", () => ({ env: { CRON_SECRET: "test-cron-secret" } }));
vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

/**
 * A chainable query builder that records every call; awaiting it asks
 * `resolveQuery(table, calls)` for the response.
 */
function makeQuery(table: string): unknown {
  const query = { calls: [] as unknown[][], table };
  queries.push(query);
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return async (
            onFulfilled: (value: unknown) => unknown,
            onRejected: (reason: unknown) => unknown,
          ) =>
            Promise.resolve(resolveQuery(table, query.calls)).then(
              onFulfilled,
              onRejected,
            );
        }
        return (...args: unknown[]) => {
          query.calls.push([prop, ...args]);
          return builder;
        };
      },
    },
  );
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: (table: string) => makeQuery(table) }),
}));

import { GET } from "../route";

const PERFUME_ID = "11111111-1111-4111-8111-111111111111";

const firstSelect = (calls: unknown[][]): unknown =>
  calls.find(([method]) => method === "select")?.[1];
const isInsert = (calls: unknown[][]): boolean =>
  calls.some(([method]) => method === "insert");

/** Responses of a healthy database where no challenge exists yet. */
function healthyResponse(table: string, calls: unknown[][]): unknown {
  if (table === "perfume_assets") {
    return { data: [{ perfume_id: PERFUME_ID }], error: null };
  }
  if (isInsert(calls)) return { data: { id: "new-challenge" }, error: null };
  switch (firstSelect(calls)) {
    case "id, challenge_number, perfume_id": {
      return { data: null, error: null };
    }
    case "perfume_id": {
      return { data: [], error: null };
    }
    default: {
      return { data: { challenge_number: 7 }, error: null };
    }
  }
}

const callCron = async () =>
  GET(
    new NextRequest("http://localhost:3000/api/cron/generate-daily", {
      headers: { Authorization: "Bearer test-cron-secret" },
    }),
  );

const inserted = () =>
  queries.filter((query) => isInsert(query.calls)).map((query) => query.table);

describe("generate-daily cron failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.length = 0;
    resolveQuery.mockImplementation(healthyResponse);
  });

  it("creates the missing challenges from a healthy database", async () => {
    const response = await callCron();

    expect(response.status).toBe(200);
    expect(inserted()).toEqual(["daily_challenges", "daily_challenges"]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("fails and reports when the existing-challenge lookup errors", async () => {
    resolveQuery.mockImplementation((table: string, calls: unknown[][]) =>
      firstSelect(calls) === "id, challenge_number, perfume_id"
        ? { data: null, error: { message: "connection reset" } }
        : healthyResponse(table, calls),
    );

    const response = await callCron();

    expect(response.status).toBe(500);
    expect(inserted()).toEqual([]);
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("fails instead of ignoring recent puzzles when the exclusion list errors", async () => {
    resolveQuery.mockImplementation((table: string, calls: unknown[][]) =>
      table === "daily_challenges" && firstSelect(calls) === "perfume_id"
        ? { data: null, error: { message: "timeout" } }
        : healthyResponse(table, calls),
    );

    const response = await callCron();

    expect(response.status).toBe(500);
    expect(inserted()).toEqual([]);
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("refreshes the cached puzzle when tomorrow fails after today was saved", async () => {
    resolveQuery.mockImplementation((table: string, calls: unknown[][]) =>
      table === "perfume_assets" && inserted().length > 0
        ? { data: null, error: { message: "timeout" } }
        : healthyResponse(table, calls),
    );

    const response = await callCron();

    expect(response.status).toBe(500);
    expect(inserted()).toEqual(["daily_challenges"]);
    expect(revalidateTag).toHaveBeenCalledWith("daily-challenge", {});
  });

  it("draws only active perfumes with notes and a difficulty score", async () => {
    await callCron();

    const candidateQuery = queries.find(
      (query) => query.table === "perfume_assets",
    );
    expect(candidateQuery?.calls).toEqual(
      expect.arrayContaining([
        ["eq", "perfumes.is_active", true],
        ["not", "perfumes.xsolve_score", "is", null],
        ["filter", "perfumes.top_notes", "neq", "{}"],
      ]),
    );
  });
});
