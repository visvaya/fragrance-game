"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Last item of the GameHeader menu for a registered player: signs out and reloads the page.
 * @param props - Component props.
 * @param props.onSelect - Called before signing out, to close the menu.
 */
export function SignOutMenuItem({
  onSelect,
}: {
  readonly onSelect: () => void;
}) {
  const t = useTranslations("Header");

  return (
    <button
      className="flex items-center gap-2 border-t border-border px-5 py-3 text-left font-[family-name:var(--font-playfair)] text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-primary/15 active:text-foreground active:duration-0"
      onClick={async () => {
        onSelect();
        const { createClient } = await import("@/lib/supabase/client");
        await createClient().auth.signOut();
        // Hard reload: reinitializes GameProvider with a new anonymous session,
        // which restores the "Zobacz profil" button in the menu.
        globalThis.location.reload();
      }}
    >
      <LogOut aria-hidden="true" className="size-4 shrink-0" />
      {t("signOut")}
    </button>
  );
}
