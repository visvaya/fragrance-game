"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useUIPreferences } from "@/components/game/contexts";

/** Sonner toaster in the theme chosen in the game menu (the app sets dark mode itself, without next-themes). */
const Toaster = ({ ...props }: ToasterProps) => {
  const { uiPreferences } = useUIPreferences();

  return (
    <Sonner
      // eslint-disable-next-line better-tailwindcss/no-unknown-classes -- toaster is a Sonner library class name, not a Tailwind class
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--popover-foreground)",
        } as React.CSSProperties
      }
      theme={uiPreferences.theme}
      {...props}
    />
  );
};

export { Toaster };
