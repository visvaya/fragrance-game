"use client";

import { useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { Loader2, Monitor, Smartphone, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BULLET_CHAR } from "@/lib/constants";
import { getDateLocale } from "@/lib/i18n/date-fns";

export type Session = {
  created_at: string;
  device_info: {
    browser?: string;
    device_type?: string;
    os?: string;
    userAgent?: string;
  };
  id: string;
  ip_address: string;
  is_current?: boolean;
  last_active_at: string;
};

type SessionCardProperties = {
  readonly isCurrent: boolean;
  readonly onRevoke: (id: string) => Promise<void>;
  readonly session: Session;
};

/**
 *
 */
export function SessionCard({
  isCurrent,
  onRevoke,
  session,
}: SessionCardProperties) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations("Sessions");
  const locale = useTranslations("Locale")("code");

  const handleRevoke = async () => {
    setLoading(true);
    await onRevoke(session.id);
    setLoading(false);
  };

  const getIcon = () => {
    // Simple heuristic based on UA string if not parsed
    const ua = session.device_info.userAgent || "";
    if (ua.includes("Mobile")) return <Smartphone className="size-5 " />;
    return <Monitor className="size-5 " />;
  };

  return (
    <Card className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-muted p-2">{getIcon()}</div>
        <div>
          <p className="text-sm font-medium">
            {session.device_info.browser || t("unknownBrowser")}
            {session.device_info.os
              ? ` on ${session.device_info.os}`
              : ` (${t("unknownOS")})`}
          </p>
          <div className="flex flex-col text-xs text-muted-foreground sm:flex-row sm:gap-2">
            <span>{session.ip_address}</span>
            <span className="hidden sm:inline">{BULLET_CHAR}</span>
            <span>
              {t("lastActive", {
                time: formatDistanceToNow(new Date(session.last_active_at), {
                  addSuffix: true,
                  locale: getDateLocale(locale),
                }),
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isCurrent ? (
          <Badge variant="secondary">{t("currentDevice")}</Badge>
        ) : null}
        {!isCurrent && (
          <Button
            aria-label={t("revoke")}
            disabled={loading}
            onClick={handleRevoke}
            size="icon"
            variant="ghost"
          >
            {loading ? (
              <Loader2 className="size-4  animate-spin" />
            ) : (
              <Trash2 className="size-4  text-muted-foreground hover:text-destructive" />
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
