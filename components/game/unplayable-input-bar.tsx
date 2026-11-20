"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useGameActions, useGameState } from "./contexts";

/**
 * The input bar when no move can be made: the game is over, or no puzzle has loaded.
 * A signed-in start-up that loaded no puzzle offers a retry, because a failed fetch and a day
 * without a puzzle look the same to the client and retrying is harmless in both cases.
 * @param root0 - Component props.
 * @param root0.noPuzzle - True when no puzzle has loaded; false when the game is over.
 */
export function UnplayableInputBar({
  noPuzzle,
}: Readonly<{ noPuzzle: boolean }>) {
  const { authReady } = useGameState();
  const { retryStart } = useGameActions();
  const t = useTranslations("Game.input");

  return (
    <div className="sticky bottom-0 z-30 mx-auto w-full max-w-2xl will-change-transform wide:max-w-xl">
      <div className="relative border-x-0 border-t panel-border bg-background/70 px-5 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] panel-shadow backdrop-blur-md transition-colors duration-500 ease-in-out sm:rounded-t-md sm:border-x">
        <div className="relative flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span className="font-hand text-lg text-primary">
            {noPuzzle ? t("noPuzzle") : t("closed")}
          </span>
          {noPuzzle && authReady ? (
            <Button
              onClick={() => void retryStart()}
              size="sm"
              variant="outline"
            >
              {t("retry")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
