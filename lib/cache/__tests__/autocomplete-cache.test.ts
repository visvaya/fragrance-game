import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: { get: mockGet, set: mockSet },
}));

import {
  getCachedAutocomplete,
  setCachedAutocomplete,
} from "../autocomplete-cache";

import type { PerfumeSuggestion } from "@/lib/types/game";

const mockSuggestions: PerfumeSuggestion[] = [
  {
    brand_masked: "Chanel",
    brand_norm: "chanel",
    concentration: "Eau de Parfum",
    display_name: "Chanel - No. 5 (1921)",
    name: "No. 5",
    name_norm: "no 5",
    perfume_id: "abc-1",
    raw_year: 1921,
    year: "1921",
  },
  {
    brand_masked: "Dior",
    brand_norm: "dior",
    concentration: "Sauvage",
    display_name: "Dior - Sauvage (2015)",
    name: "Sauvage",
    name_norm: "sauvage",
    perfume_id: "abc-2",
    raw_year: 2015,
    year: "2015",
  },
];

describe("autocomplete-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCachedAutocomplete", () => {
    it("returns cached suggestions on cache hit", async () => {
      mockGet.mockResolvedValueOnce(mockSuggestions);

      const result = await getCachedAutocomplete("chanel", 10);

      expect(result).toEqual(mockSuggestions);
    });

    it("returns null on cache miss", async () => {
      mockGet.mockResolvedValueOnce(null);

      const result = await getCachedAutocomplete("unknown-query", 5);

      expect(result).toBeNull();
    });

    it("returns null when Redis throws (graceful degradation)", async () => {
      mockGet.mockRejectedValueOnce(new Error("Redis connection failed"));

      const result = await getCachedAutocomplete("chanel", 10);

      expect(result).toBeNull();
    });

    it("calls redis.get with normalized lowercase key", async () => {
      mockGet.mockResolvedValueOnce(null);

      await getCachedAutocomplete("CHANEL", 10);

      expect(mockGet).toHaveBeenCalledWith("autocomplete:v2:chanel:10");
    });

    it("normalizes query by trimming whitespace", async () => {
      mockGet.mockResolvedValueOnce(null);

      await getCachedAutocomplete("  rose  ", 5);

      expect(mockGet).toHaveBeenCalledWith("autocomplete:v2:rose:5");
    });

    it("includes limit in cache key", async () => {
      mockGet.mockResolvedValueOnce(null);

      await getCachedAutocomplete("oud", 20);

      expect(mockGet).toHaveBeenCalledWith("autocomplete:v2:oud:20");
    });
  });

  describe("setCachedAutocomplete", () => {
    it("stores results in Redis with correct key, data, and TTL", async () => {
      mockSet.mockResolvedValueOnce("OK");

      await setCachedAutocomplete("chanel", 10, mockSuggestions);

      expect(mockSet).toHaveBeenCalledWith(
        "autocomplete:v2:chanel:10",
        mockSuggestions,
        { ex: 300 },
      );
    });

    it("resolves without throwing on success", async () => {
      mockSet.mockResolvedValueOnce("OK");

      await expect(
        setCachedAutocomplete("rose", 5, mockSuggestions),
      ).resolves.toBeUndefined();
    });

    it("does not throw when Redis set fails (graceful degradation)", async () => {
      mockSet.mockRejectedValueOnce(new Error("Redis write error"));

      await expect(
        setCachedAutocomplete("oud", 10, mockSuggestions),
      ).resolves.toBeUndefined();
    });

    it("normalizes query to lowercase for cache key", async () => {
      mockSet.mockResolvedValueOnce("OK");

      await setCachedAutocomplete("JASMINE", 5, mockSuggestions);

      expect(mockSet).toHaveBeenCalledWith(
        "autocomplete:v2:jasmine:5",
        mockSuggestions,
        expect.anything(),
      );
    });
  });
});
