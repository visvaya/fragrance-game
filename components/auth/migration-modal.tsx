"use client";

// eslint-disable-next-line no-restricted-imports -- DATA_FETCH: asks the server whether this browser holds guest games after sign-in
import { useEffect, useState } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  declineGuestMerge,
  getPendingGuestMerge,
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
import { GUEST_TICKET_CONFIG } from "@/lib/auth/guest-ticket-config";

/** True when the readable hint cookie says this browser played as a guest. */
function hasGuestHint(): boolean {
  const expected = `${GUEST_TICKET_CONFIG.hintCookieName}=1`;
  return document.cookie.split(";").some((part) => part.trim() === expected);
}

/**
 * Shown after sign-in when this browser holds games played without an
 * account. The player either adds them to the account or drops the earlier
 * days; today's puzzle stays on the account either way (server side).
 */
export function MigrationModal() {
  const t = useTranslations("Migration");
  const [isOpen, setIsOpen] = useState(false);
  const [todayMoves, setTodayMoves] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useGameState();

  useEffect(() => {
    if (!user || user.is_anonymous || !hasGuestHint()) return;
    const checkPending = async () => {
      try {
        const result = await getPendingGuestMerge();
        if (!result.pending) return;
        setTodayMoves(result.todayMoves);
        setIsOpen(true);
      } catch (error) {
        // Non-critical: without an answer the modal stays closed this visit.
        console.error("[MigrationModal] Pending check failed:", error);
      }
    };
    void checkPending();
  }, [user]);

  const handleMerge = async () => {
    setIsLoading(true);
    try {
      const result = await mergeGuestGames();
      if ("error" in result) {
        toast.error(t("error"));
        setIsLoading(false);
        return;
      }
      toast.success(t("success"));
      globalThis.location.reload();
    } catch (error) {
      console.error("[MigrationModal] Merge failed:", error);
      toast.error(t("error"));
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    if (isLoading || !globalThis.confirm(t("cancelConfirm"))) return;
    setIsLoading(true);
    try {
      const result = await declineGuestMerge();
      if ("error" in result) {
        toast.error(t("declineError"));
        setIsLoading(false);
        return;
      }
      globalThis.location.reload();
    } catch (error) {
      console.error("[MigrationModal] Decline failed:", error);
      toast.error(t("declineError"));
      setIsLoading(false);
    }
  };

  // Close button, Escape and outside click take the same path as "cancel".
  const handleOpenChange = async (open: boolean) => {
    if (open) return;
    await handleDecline();
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
              {todayMoves ? <p className="font-medium">{t("today")}</p> : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={isLoading} onClick={handleDecline} variant="ghost">
            {t("cancel")}
          </Button>
          <Button disabled={isLoading} onClick={handleMerge}>
            {isLoading ? (
              <Loader2
                aria-hidden="true"
                className="mr-2 size-4 animate-spin"
              />
            ) : null}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
