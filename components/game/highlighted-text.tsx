import { memo, useMemo } from "react";

import { normalizeText } from "@/lib/utils";

type Match = { end: number; start: number };

/** Recursively finds all exact occurrences of `term` in `text` starting from `offset`. */
function findExactMatches(text: string, term: string, offset = 0): Match[] {
  const pos = text.indexOf(term, offset);
  if (pos === -1) return [];
  return [{ end: pos + term.length, start: pos }, ...findExactMatches(text, term, pos + 1)];
}

/** Merges overlapping/adjacent intervals. Input must be sorted by start ascending. */
function mergeIntervals(
  current: Match,
  rest: Match[],
  accumulator: Match[],
): Match[] {
  if (rest.length === 0) return [...accumulator, current];
  const [next, ...remaining] = rest;
  if (next.start <= current.end) {
    return mergeIntervals({ end: Math.max(current.end, next.end), start: current.start }, remaining, accumulator);
  }
  return mergeIntervals(next, remaining, [...accumulator, current]);
}

export const HighlightedText = memo(
  ({ query, text }: Readonly<{ query: string; text: string }>) => {
     
    const tokens = useMemo(() => {
      if (!query || query.trim().length < 2) return [text];

      const normalizedText = normalizeText(text);
      const searchTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length >= 2)
        .map((term) => normalizeText(term));

      if (searchTerms.length === 0) return [text];

      // Collect all match positions via flatMap — no mutable accumulator
      const allMatches = searchTerms.flatMap((term) => {
        const exactMatches = findExactMatches(normalizedText, term);
        if (exactMatches.length > 0 || term.length < 4) return exactMatches;

        // Fuzzy prefix matching: "extremel" matches "extreme" (7/8 chars)
        const words = normalizedText.split(/\s+/);
        return words.flatMap((word, i) => {
          // Calculate word start position using prefix lengths
          const wordStart = words.slice(0, i).join(" ").length + (i > 0 ? 1 : 0);
          const minPrefixLength = Math.min(term.length - 1, word.length);
          if (
            minPrefixLength >= 4 &&
            term.slice(0, minPrefixLength) === word.slice(0, minPrefixLength) &&
            Math.abs(term.length - word.length) <= 2
          ) {
            return [{ end: wordStart + word.length, start: wordStart }];
          }
          return [];
        });
      });

      if (allMatches.length === 0) return [text];

      const sortedMatches = allMatches.toSorted((a, b) =>
        a.start === b.start ? b.end - a.end : a.start - b.start,
      );

      const mergedMatches = mergeIntervals(sortedMatches[0], sortedMatches.slice(1), []);

      // Build result nodes: for each match, output [text-before?, <b>highlighted</b>]
      // Sentinel at end handles trailing text after last match
      const withSentinel = [...mergedMatches, { end: text.length, start: text.length }];
      return withSentinel.flatMap((match, i) => {
        const previousEnd = i === 0 ? 0 : (mergedMatches[i - 1]?.end ?? 0);
        const before: React.ReactNode[] = previousEnd < match.start ? [text.slice(previousEnd, match.start)] : [];
        const highlighted: React.ReactNode[] =
          match.start < text.length
            ? [
                <b className="font-bold" key={`match-${match.start}-${match.end}`}>
                  {text.slice(match.start, match.end)}
                </b>,
              ]
            : [];
        return [...before, ...highlighted];
      });
    }, [text, query]);

    return <>{tokens}</>;
  },
);
