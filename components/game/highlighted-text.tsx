import { memo, useMemo } from "react";

import { normalizeText } from "@/lib/utils";

export const HighlightedText = memo(
  ({ query, text }: Readonly<{ query: string; text: string }>) => {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    const tokens = useMemo(() => {
      if (!query || query.trim().length < 2) return [text];

      const normalizedText = normalizeText(text);
      const searchTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length >= 2)
        .map((term) => normalizeText(term));

      if (searchTerms.length === 0) return [text];

      // Find all matches for all terms (exact + fuzzy)
      const matches: { end: number; start: number }[] = [];
      for (const term of searchTerms) {
        // First try exact match
        let startPos = 0;
        while ((startPos = normalizedText.indexOf(term, startPos)) !== -1) {
          matches.push({ end: startPos + term.length, start: startPos });
          startPos += 1;
        }

        // If no exact match and term is long enough, try fuzzy prefix matching
        // e.g., "extremel" matches "extreme" (7/8 chars match)
        if (matches.length === 0 && term.length >= 4) {
          const words = normalizedText.split(/\s+/);
          let wordStart = 0;

          for (const word of words) {
            // Check if word starts with most of the term (fuzzy prefix)
            const minPrefixLength = Math.min(term.length - 1, word.length);
            const termPrefix = term.slice(0, minPrefixLength);
            const wordPrefix = word.slice(0, minPrefixLength);

            if (
              minPrefixLength >= 4 &&
              termPrefix === wordPrefix &&
              Math.abs(term.length - word.length) <= 2
            ) {
              // Fuzzy match - highlight the whole word
              matches.push({ end: wordStart + word.length, start: wordStart });
            }

            wordStart += word.length + 1; // +1 for space
          }
        }
      }

      if (matches.length === 0) return [text];

      // Sort matches
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      matches.sort((a, b) => a.start - b.start || b.end - a.end);

      // Merge matches
      const mergedMatches: { end: number; start: number }[] = [];
      if (matches.length > 0) {
        let currentMatch = matches[0];
        for (let i = 1; i < matches.length; i++) {
          if (matches[i].start <= currentMatch.end) {
            currentMatch.end = Math.max(currentMatch.end, matches[i].end);
          } else {
            mergedMatches.push(currentMatch);
            currentMatch = matches[i];
          }
        }
        mergedMatches.push(currentMatch);
      }

      // Build result
      const result: React.ReactNode[] = [];
      let lastIndex = 0;

      for (const match of mergedMatches) {
        if (match.start > lastIndex) {
          result.push(text.slice(lastIndex, match.start));
        }
        result.push(
          <b className="font-bold" key={`match-${match.start}-${match.end}`}>
            {text.slice(match.start, match.end)}
          </b>,
        );
        lastIndex = match.end;
      }

      if (lastIndex < text.length) {
        result.push(text.slice(lastIndex));
      }

      return result;
    }, [text, query]);

    return <>{tokens}</>;
  },
);
