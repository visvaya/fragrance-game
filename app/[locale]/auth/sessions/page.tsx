import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { revokeSession } from "@/app/actions/auth-actions";
import { SessionCard, type Session } from "@/components/auth/session-card";
import { createClient } from "@/lib/supabase/server";

/** Displays all active sessions for the authenticated user with option to revoke each. */
export default async function SessionsPage() {
  const supabase = await createClient();
  const t = await getTranslations("Sessions");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: sessions } = await supabase
    .from("user_sessions")
    .select(
      "id, user_id, device_info, ip_address, last_active_at, created_at, revoked_at",
    )
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false });

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-muted-foreground">{t("description")}</p>

      <div className="space-y-4">
        {(sessions as Session[] | null)?.map((session) => (
          <SessionCard
            isCurrent={false} // Will be updated by client hook if we wrap it or handle in Card
            key={session.id}
            onRevoke={revokeSession}
            session={session}
          />
        ))}

        {(!sessions || sessions.length === 0) && (
          <p className="text-muted-foreground">{t("noSessions")}</p>
        )}
      </div>
    </div>
  );
}
