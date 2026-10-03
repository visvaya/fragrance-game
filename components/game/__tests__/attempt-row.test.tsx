/**
 * Tests for the AttemptRow feedback cells driven by server feedback and clues.
 */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, vi } from "vitest";

import { HIDDEN_CLUES, type RevealedClues } from "@/lib/game/clue-reveal";

import { AttemptRow } from "../attempt-row";

import type { Attempt } from "../contexts/game-state-context";

vi.mock("@/components/game/game-tooltip", () => ({
  GameTooltip: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: React.ReactNode;
  }) => (
    <div
      data-testid={
        typeof content === "string" ? `tooltip-${content}` : undefined
      }
    >
      {children}
    </div>
  ),
}));

const MESSAGES = {
  AttemptLog: {
    by: "by",
    skipped: "Skipped",
    tooltips: {
      brandCorrect: "Brand: Correct",
      brandIncorrect: "Brand: Incorrect",
      brandMissing: "Brand: No data",
      genderCorrect: "Gender: Correct",
      genderIncorrect: "Gender: Incorrect",
      genderMissing: "Gender: No data",
      genderUnknown: "Gender: Unknown",
      notesCorrect: "Notes: 100%",
      notesMissing: "Notes: No data",
      notesPercentage: "Notes: {percent}%",
      perfumerFull: "Perfumer: Full",
      perfumerIncorrect: "Perfumer: Incorrect",
      perfumerMissing: "Perfumer: No data",
      perfumerPartial: "Perfumer: Partial",
      yearCloseHigher: "Year: Close higher",
      yearCloseLower: "Year: Close lower",
      yearCorrect: "Year: Correct",
      yearMissing: "Year: No data",
      yearWrongHigher: "Year: Higher",
      yearWrongLower: "Year: Lower",
    },
  },
};

const ATTEMPT: Attempt = {
  brand: "Chanel",
  feedback: {
    brandMatch: false,
    genderMatch: true,
    notesMatch: 0,
    perfumerMatch: "none",
    yearDirection: "higher",
    yearMatch: "wrong",
  },
  gender: "Female",
  guess: "No. 5",
  hasGuessedNotes: true,
  perfumeId: "perfume-1",
  perfumers: ["Ernest Beaux"],
  year: 1921,
};

function renderRow(attempt: Attempt, clues: RevealedClues = HIDDEN_CLUES) {
  return render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <AttemptRow
        activeRowIndex={null}
        attempt={attempt}
        clues={clues}
        handleClick={vi.fn()}
        handlePointerDown={vi.fn()}
        index={0}
        isNew={false}
        isTouch={false}
        totalAttempts={1}
      />
    </NextIntlClientProvider>,
  );
}

describe("AttemptRow: gender cell", () => {
  it("shows the check icon when the server reports a gender match", () => {
    renderRow(ATTEMPT);
    expect(screen.getByTestId("tooltip-Gender: Correct")).toBeInTheDocument();
    expect(
      screen.queryByTestId("tooltip-Gender: Incorrect"),
    ).not.toBeInTheDocument();
  });

  it("shows the incorrect state when the server reports no match", () => {
    renderRow({
      ...ATTEMPT,
      feedback: { ...ATTEMPT.feedback, genderMatch: false },
    });
    expect(screen.getByTestId("tooltip-Gender: Incorrect")).toBeInTheDocument();
  });

  it("shows the missing placeholder when the answer has no gender", () => {
    renderRow(ATTEMPT, {
      ...HIDDEN_CLUES,
      answerHas: { ...HIDDEN_CLUES.answerHas, gender: false },
    });
    expect(screen.getByTestId("tooltip-Gender: No data")).toBeInTheDocument();
    expect(
      screen.queryByTestId("tooltip-Gender: Correct"),
    ).not.toBeInTheDocument();
  });

  it("shows the missing placeholder when the guess gender is unknown", () => {
    renderRow({ ...ATTEMPT, gender: "Unknown" });
    expect(screen.getByTestId("tooltip-Gender: No data")).toBeInTheDocument();
  });
});

describe("AttemptRow: missing answer data", () => {
  it("uses answerHas for brand, perfumer, year and notes", () => {
    renderRow(ATTEMPT, {
      ...HIDDEN_CLUES,
      answerHas: {
        brand: false,
        gender: true,
        notes: false,
        perfumer: false,
        year: false,
      },
    });
    for (const label of [
      "Brand: No data",
      "Perfumer: No data",
      "Year: No data",
      "Notes: No data",
    ]) {
      expect(screen.getByTestId(`tooltip-${label}`)).toBeInTheDocument();
    }
  });
});
