/* eslint-disable eauxle/restricted-syntax -- Required for strict breakpoints (min-[350px]) */

import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Reusable toggle pill used in the appearance settings section. */
function TogglePill({ isOn }: { readonly isOn: boolean }) {
  return (
    <div
      className={cn(
        "relative h-4 w-8 rounded-full transition-colors",
        isOn ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <div
        className={cn(
          "absolute top-0.5 size-3 rounded-full bg-white transition-all",
          isOn ? "left-4.5" : "left-0.5",
        )}
      />
    </div>
  );
}

/** One switch of the appearance section: icon, label and the pill showing whether it is on. */
export function AppearanceToggle({
  className,
  icon: Icon,
  isOn,
  label,
  onClick,
}: Readonly<{
  className?: string;
  icon: LucideIcon;
  isOn: boolean;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      className={cn(
        "group flex w-full items-center justify-between gap-2 text-foreground transition-colors hover:text-primary",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        <span className="text-left font-sans text-xs leading-tight">
          {label}
        </span>
      </div>
      <TogglePill isOn={isOn} />
    </button>
  );
}

/** One plain entry of the settings menu. */
export function MenuItem({
  children,
  onClick,
}: Readonly<{ children: ReactNode; onClick: () => void }>) {
  return (
    <button
      className="w-full border-b border-border p-3 text-left font-[family-name:var(--font-playfair)] leading-tight text-foreground transition-colors duration-300 hover:bg-muted/50 hover:text-foreground active:bg-primary/15 active:text-foreground active:duration-0 min-[350px]:px-5"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
