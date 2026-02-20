"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { migrateAnonymousPlayer } from "@/app/actions/auth-actions";
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

  useEffect(() => {
    const checkMigration = async () => {
      // 1. Check if we have an anonymous player ID stored
      const anonId = localStorage.getItem("eauxle_anon_player_id");
      if (!anonId) return;

      // 2. Check if we are currently logged in
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

    checkMigration();
  }, []);

  // Track if a legitimate choice (Merge or Skip) was made
  const [choiceMade, setChoiceMade] = useState(false);

  // If modal closes WITHOUT a choice (e.g. X button, Esc, outside click),
  // we warn the user and log them out if they confirm.
  const handleOpenChange = async (open: boolean) => {
    if (!open && !choiceMade) {
      // User is trying to close without choosing
      // We need to use a slight timeout to allow the Dialog to process the close event first?
      // Actually, if we return early here, the Dialog state won't update if we control it.
      // This modal must be blocking. User MUST decide.
      // If they close without deciding, we interpret that as "I want to go back to being anonymous"
      // To achieve this UX, we will hook into onOpenChange.

      // Note: Radix Dialog primitives might unmount content if we just let it happen.
      // We want to intercept.
      // Standard window.confirm pauses execution.
      if (globalThis.confirm(t("exitConfirm"))) {
        // User chose to "Exit and restore anonymous state"
        setIsLoading(true); // Show loading state briefly
        const supabase = createClient();
        // We sign out to restore the previous anonymous state (or clean state)
        await supabase.auth.signOut();
        globalThis.location.reload(); // Hard reload to clear state and show anonymous view
      } else {
        // User cancelled exit - do NOT close modal
        // We force it to stay open; since this function is triggered by an attempted close,
        // stopping propagation is tricky in controlled component.
        // But by NOT updating setIsOpen(false), we keep it open in the next render cycle.
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

  const handleCancel = () => {
    // User declined migration. Clear storage to avoid pestering.
    setChoiceMade(true);
    localStorage.removeItem("eauxle_anon_player_id");
    setIsOpen(false);
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
            onClick={() => {
              if (globalThis.confirm(t("cancelConfirm"))) {
                handleCancel();
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
