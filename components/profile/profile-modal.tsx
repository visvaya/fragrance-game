"use client";

import { format } from "date-fns";
import { pl, enUS } from "date-fns/locale";
import {
  User as UserIcon,
  Mail,
  Shield,
  Trophy,
  Activity,
  Calendar,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import type { User } from "@supabase/supabase-js";

type ProfileModalProperties = {
  onClose: () => void;
  open: boolean;
  user: User | null;
};

/**
 *
 */
export function ProfileModal({ onClose, open, user }: ProfileModalProperties) {
  const t = useTranslations("Profile");
  const locale = useTranslations("Locale")("code");

  if (!user) return null;

  // Placeholder stats - in real app, fetch from DB
  const stats = [
    { icon: Activity, label: t("gamesPlayed"), value: "12" },
    { icon: Trophy, label: t("totalWins"), value: "8" },
    { icon: UserIcon, label: t("activeStreak"), value: "3" },
  ];

  const joinDate = user.created_at
    ? format(new Date(user.created_at), "PPP", {
        locale: locale === "pl" ? pl : enUS,
      })
    : "-";

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : "U";

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>

          <div className="space-y-1 text-center">
            <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold">
              {user.user_metadata?.full_name ||
                user.email?.split("@")[0] ||
                t("anonymous")}
            </h2>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span>{user.email}</span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {t("joined")}: {joinDate}
              </span>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <Badge className="gap-1" variant="outline">
              <Shield className="h-3 w-3" />
              {user.app_metadata?.provider === "email" ? "Email" : "OAuth"}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-4 py-4">
          {stats.map((stat, i) => (
            <div
              className="flex flex-col items-center justify-center rounded-lg bg-muted/30 p-2 text-center"
              key={stat.label}
            >
              <stat.icon className="mb-1 h-5 w-5 text-primary" />
              <div className="text-lg font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
