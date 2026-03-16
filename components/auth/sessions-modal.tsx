"use client";

import { useEffect, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { Laptop, Phone, Globe, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UAParser } from "ua-parser-js";

import {
  getSessions,
  revokeSession,
  revokeAllSessions,
} from "@/app/actions/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDateLocale } from "@/lib/i18n/date-fns";
import { createClient } from "@/lib/supabase/client";

import type { Json } from "@/types/supabase";
import type { User } from "@supabase/supabase-js";

type Session = {
  created_at: string | null;
  device_info: Json | null;
  id: string;
  ip_address: unknown;
  last_active_at: string | null;
  revoked_at: string | null;
  user_id: string;
};

type SessionsModalProperties = {
  readonly onClose: () => void;
  readonly open: boolean;
  readonly user: User;
};

export function SessionsModal({
  onClose,
  open,
  user,
}: SessionsModalProperties) {
  const [state, setState] = useState<{
    currentSessionId: string | null;
    isLoading: boolean;
    sessions: Session[];
  }>({
    currentSessionId: null,
    isLoading: true,
    sessions: [],
  });

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const t = useTranslations("Sessions");
  const tLocale = useTranslations("Locale");
  const currentLocaleCode = tLocale("code");

  // Don't fetch sessions for anonymous users as they are not tracked in user_sessions the same way
  // or should not be manageable
  const isAnonymous = user.is_anonymous;

  useEffect(() => {
    const fetchSessionsInternal = async () => {
      if (isAnonymous) {
        setState((previous) => ({
          ...previous,
          isLoading: false,
          sessions: [],
        }));
        return;
      }

      setState((previous) => ({ ...previous, isLoading: true }));
      try {
        const data = await getSessions();
        const newSessions = data as Session[];

        if (newSessions.length > 0) {
          const sorted = newSessions.toSorted(
            (a, b) =>
              new Date(b.last_active_at ?? 0).getTime() -
              new Date(a.last_active_at ?? 0).getTime(),
          );

          const currentUA = navigator.userAgent;
          const match = sorted.find((s) => {
            const storedUA =
              typeof s.device_info === "object" &&
              s.device_info !== null &&
              "user_agent" in s.device_info
                ? (s.device_info.user_agent as string)
                : "";
            return storedUA === currentUA;
          });
          const newSessionId: string | null = match?.id ?? sorted[0].id;

          setState((previous) => ({
            ...previous,
            currentSessionId: newSessionId,
            isLoading: false,
            sessions: newSessions,
          }));
        } else {
          setState((previous) => ({
            ...previous,
            isLoading: false,
            sessions: newSessions,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch sessions", error);
        toast.error(t("fetchError"));
        setState((previous) => ({ ...previous, isLoading: false }));
        return;
      }
    };

    if (open) {
      void fetchSessionsInternal();
    }
  }, [open, isAnonymous, t]);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      // Check if this is the last session before revocation
      const isLastSession = state.sessions.length === 1;

      const result = await revokeSession(sessionId);
      if (result.success) {
        if (isLastSession) {
          // Force immediate logout if the only session is revoked
          const supabase = createClient();
          await supabase.auth.signOut();
          globalThis.location.reload();
          return;
        }

        toast.success(t("revokeSuccess"));
        // Optimistically remove from list or refetch
        setState((previous) => ({
          ...previous,
          sessions: previous.sessions.filter((s) => s.id !== sessionId),
        }));
      } else {
        toast.error(t("revokeError"));
      }
      setRevokingId(null);
    } catch {
      toast.error(t("revokeError"));
      setRevokingId(null);
    }
  };

  const getDeviceIcon = (deviceInfo: Json | null) => {
    const userAgent =
      typeof deviceInfo === "object" &&
      deviceInfo !== null &&
      "user_agent" in deviceInfo
        ? (deviceInfo.user_agent as string)
        : "";

    if (
      userAgent === "node" ||
      userAgent.toLowerCase().includes("node-fetch")
    ) {
      return <Laptop className="size-4" />;
    }
    const ua = new UAParser(userAgent);
    const device = ua.getDevice();
    if (device.type === "mobile" || device.type === "tablet") {
      return <Phone className="size-4" />;
    }
    return <Laptop className="size-4" />;
  };

  const formatDeviceInfo = (deviceInfo: Json | null) => {
    const userAgent =
      typeof deviceInfo === "object" &&
      deviceInfo !== null &&
      "user_agent" in deviceInfo
        ? (deviceInfo.user_agent as string)
        : "";

    if (
      userAgent === "node" ||
      userAgent.toLowerCase().includes("node-fetch")
    ) {
      return t("currentDevice");
    }

    const ua = new UAParser(userAgent);
    const browser = ua.getBrowser();
    const os = ua.getOS();

    if (!browser.name && !os.name) return userAgent.slice(0, 30) + "...";

    return `${browser.name ?? t("unknownBrowser")} on ${os.name ?? t("unknownOS")}`;
  };

  /**
   * Render internal content of the scroll area
   */
  const renderContent = () => {
    if (isAnonymous) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-8 text-center text-muted-foreground">
          <p>{t("anonymousDescription")}</p>
          <Button onClick={onClose} variant="outline">
            {t("anonymousClose")}
          </Button>
        </div>
      );
    }

    if (state.isLoading) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (state.sessions.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          {t("noSessions")}
        </div>
      );
    }

    return (
      <div className="space-y-4 pt-1">
        <div className="mb-4 flex justify-end">
          <Button
            onClick={async () => {
              if (globalThis.confirm(t("revokeAllConfirm"))) {
                const supabase = createClient();
                await revokeAllSessions();
                await supabase.auth.signOut();
                globalThis.location.reload();
              }
            }}
            size="sm"
            variant="destructive"
          >
            {t("revokeAll")}
          </Button>
        </div>
        {state.sessions.map((session) => {
          const lastActiveAt = session.last_active_at
            ? new Date(session.last_active_at)
            : null;

          return (
            <div
              className="flex flex-col items-start justify-between gap-4 rounded-lg border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:p-4"
              key={session.id}
            >
              <div className="flex w-full items-start gap-4">
                <div className="h-fit shrink-0 rounded-full bg-muted p-2">
                  {getDeviceIcon(session.device_info)}
                </div>
                <div className="w-full min-w-0 space-y-1">
                  <p className="text-sm leading-none font-medium break-all sm:break-normal">
                    {formatDeviceInfo(session.device_info)}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex shrink-0 items-center gap-1">
                      <Globe className="size-3" />
                      {String(session.ip_address)}
                      {session.id === state.currentSessionId && (
                        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {t("currentDevice")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0">
                      {lastActiveAt
                        ? t("lastActive", {
                            time: formatDistanceToNow(lastActiveAt, {
                              addSuffix: true,
                              locale: getDateLocale(currentLocaleCode),
                            }),
                          })
                        : null}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                className="mt-2 w-full shrink-0 sm:mt-0 sm:w-auto"
                disabled={!!revokingId}
                onClick={async () => handleRevoke(session.id)}
                size="sm"
                variant="destructive"
              >
                {revokingId === session.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t("revoke")
                )}
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="w-[95vw] rounded-lg sm:max-w-[37.5rem]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {isAnonymous ? t("anonymousHistory") : t("description")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] rounded-md bg-background/50 pr-4 sm:max-h-[60vh]">
          {renderContent()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
