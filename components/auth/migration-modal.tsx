"use client";

// eslint-disable-next-line no-restricted-imports -- subscription: listens to localStorage anon player ID to trigger migration modal
import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  declineGuestMerge,
  mergeGuestGames,
} from "@/app/actions/guest-merge-actions";
import { useGameState } from "@/components/game/contexts/game-state-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

/** Moves only today's guest game; failures leave a normal fresh start. */
async function declineQuietly(): Promise<void> {
  try {
    await declineGuestMerge();
  } catch {
    // Non-critical: the ticket stays and the player can decide on the next visit.
  }
}

/**
 * Modal shown to users who have just registered/logged in but have
 * an anonymous session history stored in localStorage.
 */
export function MigrationModal() {
  const t = useTranslations("Migration");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user } = useGameState();

  useEffect(() => {
    const checkMigration = () => {
      // 1. Check if we have an anonymous player ID stored
      const anonId = localStorage.getItem("eauxle_anon_player_id");
      if (!anonId) return;

      if (user && !user.is_anonymous && user.id !== anonId) {
        // We have a registered user and a DIFFERENT anonymous ID.
        // This suggests we just registered or logged in after playing anonymously.
        setIsOpen(true);
      }
    };

    checkMigration();
  }, [user]);

  // Track if a legitimate choice (Merge or Skip) was made
  const [choiceMade, setChoiceMade] = useState(false);

  // If modal closes WITHOUT a choice (e.g. X button, Esc, outside click),
  // we warn the user and log them out if they confirm.
  const handleOpenChange = async (open: boolean) => {
    if (open || choiceMade) {
      setIsOpen(open);
      return;
    }

    if (!globalThis.confirm(t("exitConfirm"))) {
      return;
    }

    // Same as handleCancel: today's guest game moves to the account first, so
    // dismissing via X/Esc cannot be used to start today's puzzle afresh.
    setIsLoading(true);
    await declineQuietly();
    const supabase = createClient();
    await supabase.auth.signOut();
    globalThis.location.reload();
  };

  const handleMerge = async () => {
    const anonId = localStorage.getItem("eauxle_anon_player_id");
    if (!anonId) return;

    setChoiceMade(true);
    setIsLoading(true);
    try {
      const result = await mergeGuestGames();
      if ("error" in result && result.error) {
        toast.error(t("error"));
        console.error(result.error);
        setChoiceMade(false); // Enable exit guard again on error?
        setIsLoading(false);
      } else {
        toast.success(t("success"));
        // Clear storage so we don't ask again
        localStorage.removeItem("eauxle_anon_player_id");
        setIsOpen(false);
        router.refresh();
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Migration failed:", error);
      toast.error(t("error"));
      setChoiceMade(false);
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    // User declined migration: today's guest game still moves to the account,
    // so it cannot start today's puzzle afresh with clues already seen.
    await declineQuietly();

    setChoiceMade(true);
    localStorage.removeItem("eauxle_anon_player_id");
    setIsOpen(false);
    // Reload so GameProvider reinitializes as the authenticated user
    // and picks up today's moved game.
    globalThis.location.reload();
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      {/* eslint-disable-next-line no-restricted-syntax -- shadcn/ui standard dialog width: 425px is a design system convention */}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("description")}</p>
              <p className="font-medium text-amber-600 dark:text-amber-500">
                {t("warning")}
              </p>
            </div>
          </DialogDescription>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("abortHelp")}
          </p>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            className="text-muted-foreground hover:text-destructive"
            disabled={isLoading}
            onClick={async () => {
              if (globalThis.confirm(t("cancelConfirm"))) {
                await handleCancel();
              }
            }}
            variant="ghost"
          >
            {t("cancel")}
          </Button>
          <Button disabled={isLoading} onClick={handleMerge}>
            {isLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
