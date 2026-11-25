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
function makeQuery(table: string, calls: unknown[][] = []): unknown {
  const query = { calls, table };
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
  createAdminClient: () => ({
    from: (table: string) => makeQuery(table),
    rpc: (fn: string, args: unknown) => makeQuery(fn, [["rpc", args]]),
  }),
}));

import { GET } from "../route";

const PERFUME_ID = "11111111-1111-4111-8111-111111111111";
const PICK = "pick_daily_perfume";
const PICKED = { perfume_id: PERFUME_ID, xsolve_score: 0.42 };

const firstSelect = (calls: unknown[][]): unknown =>
  calls.find(([method]) => method === "select")?.[1];
const isInsert = (calls: unknown[][]): boolean =>
  calls.some(([method]) => method === "insert");

/** Responses of a healthy database where no challenge exists yet. */
function healthyResponse(table: string, calls: unknown[][]): unknown {
  if (table === PICK) return { data: PICKED, error: null };
  if (isInsert(calls)) return { data: { id: "new-challenge" }, error: null };
  return firstSelect(calls) === "id, challenge_number, perfume_id"
    ? { data: null, error: null }
    : { data: { challenge_number: 7 }, error: null };
}

const callCron = async () =>
  GET(
    new NextRequest("http://localhost:3000/api/cron/generate-daily", {
      headers: { Authorization: "Bearer test-cron-secret" },
    }),
  );

const inserted = () =>
  queries.filter((query) => isInsert(query.calls)).map((query) => query.table);
const insertedRows = () =>
  queries.flatMap((query) =>
    query.calls.filter(([method]) => method === "insert").map(([, row]) => row),
  );
const pickArgs = () =>
  queries
    .filter((query) => query.table === PICK)
    .map((query) => query.calls[0]?.[1]);

/** The UTC date `days` days before now, as the route computes the exclusion window. */
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

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

  it("stores the difficulty the puzzle was published with", async () => {
    await callCron();

    expect(insertedRows()).toEqual([
      expect.objectContaining({
        perfume_id: PERFUME_ID,
        snapshot_metadata: { xsolve: 0.42 },
      }),
      expect.objectContaining({ snapshot_metadata: { xsolve: 0.42 } }),
    ]);
  });

  it("picks outside the last 30 days, then outside the last 7 when the pool is exhausted", async () => {
    vi.useFakeTimers({
      now: new Date("2026-03-10T00:00:05Z"),
      toFake: ["Date"],
    });
    resolveQuery.mockImplementation((table: string, calls: unknown[][]) =>
      table === PICK
        ? {
            data: pickArgs().length % 2 === 1 ? null : PICKED,
            error: null,
          }
        : healthyResponse(table, calls),
    );

    try {
      const response = await callCron();

      expect(response.status).toBe(200);
      expect(pickArgs()).toEqual([
        { exclude_since: "2026-02-08" },
        { exclude_since: "2026-03-03" },
        { exclude_since: "2026-02-08" },
        { exclude_since: "2026-03-03" },
      ]);
      expect(inserted()).toEqual(["daily_challenges", "daily_challenges"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails without inserting when no perfume is eligible", async () => {
    resolveQuery.mockImplementation((table: string, calls: unknown[][]) =>
      table === PICK
        ? { data: null, error: null }
        : healthyResponse(table, calls),
    );

    const response = await callCron();

    expect(response.status).toBe(500);
    expect(pickArgs()).toEqual([
      { exclude_since: daysAgo(30) },
      { exclude_since: daysAgo(7) },
    ]);
    expect(inserted()).toEqual([]);
    expect(captureException).toHaveBeenCalledOnce();
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

  it("fails instead of picking at random when the perfume pick errors", async () => {
    resolveQuery.mockImplementation((table: string, calls: unknown[][]) =>
      table === PICK
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
      table === PICK && inserted().length > 0
        ? { data: null, error: { message: "timeout" } }
        : healthyResponse(table, calls),
    );

    const response = await callCron();

    expect(response.status).toBe(500);
    expect(inserted()).toEqual(["daily_challenges"]);
    expect(revalidateTag).toHaveBeenCalledWith("daily-challenge", {});
  });
});
