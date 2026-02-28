"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getAnonSessionAttemptCount,
  migrateAnonymousPlayer,
} from "@/app/actions/auth-actions";
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

/**
 * Modal shown to users who have just registered/logged in but have
 * an anonymous session history stored in localStorage.
 */
export function MigrationModal() {
  const t = useTranslations("Migration");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { sessionId } = useGameState();

  useEffect(() => {
    const checkMigration = async () => {
      // 1. Check if we have an anonymous player ID stored
      const anonId = localStorage.getItem("eauxle_anon_player_id");
      if (!anonId) return;

      // 2. Check if we are currently logged in as a non-anonymous user
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && !user.is_anonymous && user.id !== anonId) {
        // We have a registered user and a DIFFERENT anonymous ID.
        // This suggests we just registered or logged in after playing anonymously.
        setIsOpen(true);
      }
    };

    // Run on mount (handles page load after login)
    void checkMigration();

    // Also run on SIGNED_IN to handle mid-session login via auth modal
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void checkMigration();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Track if a legitimate choice (Merge or Skip) was made
  const [choiceMade, setChoiceMade] = useState(false);

  // If modal closes WITHOUT a choice (e.g. X button, Esc, outside click),
  // we warn the user and log them out if they confirm.
  const handleOpenChange = async (open: boolean) => {
    if (!open && !choiceMade) {
      if (globalThis.confirm(t("exitConfirm"))) {
        setIsLoading(true);
        // Inherit attempt count before signing out — same logic as handleCancel.
        // Without this, the player could dismiss via X/Esc to get a fresh anonymous
        // session and bypass the anti-cheat inherited-attempt mechanism.
        const anonId = localStorage.getItem("eauxle_anon_player_id");
        if (anonId && sessionId) {
          try {
            const { attemptCount } = await getAnonSessionAttemptCount(
              anonId,
              sessionId,
            );
            if (attemptCount > 0) {
              sessionStorage.setItem(
                "eauxle_declined_anon_attempts",
                String(attemptCount),
              );
            }
          } catch {
            // Non-critical: if this fails, the player gets a normal fresh start
          }
        }
        const supabase = createClient();
        await supabase.auth.signOut();
        globalThis.location.reload();
      } else {
        return;
      }
    }
    setIsOpen(open);
  };

  const handleMerge = async () => {
    const anonId = localStorage.getItem("eauxle_anon_player_id");
    if (!anonId) return;

    setChoiceMade(true);
    setIsLoading(true);
    try {
      const result = await migrateAnonymousPlayer(anonId);
      if (result.error) {
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
    // User declined migration.
    // Fetch the anonymous session's attempt count BEFORE clearing storage,
    // so the new authenticated session inherits it and cannot start fresh
    // with an informational advantage from clues already seen.
    const anonId = localStorage.getItem("eauxle_anon_player_id");
    if (anonId && sessionId) {
      try {
        const { attemptCount } = await getAnonSessionAttemptCount(
          anonId,
          sessionId,
        );
        if (attemptCount > 0) {
          sessionStorage.setItem(
            "eauxle_declined_anon_attempts",
            String(attemptCount),
          );
        }
      } catch {
        // Non-critical: if this fails, the player gets a normal fresh start
      }
    }

    setChoiceMade(true);
    localStorage.removeItem("eauxle_anon_player_id");
    setIsOpen(false);
    // Reload so GameProvider reinitializes as the authenticated user
    // and picks up the inherited attempt count from sessionStorage.
    globalThis.location.reload();
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
