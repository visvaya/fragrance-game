"use client";

// eslint-disable-next-line no-restricted-imports -- error boundary: captures error prop changes via Sentry
import { useEffect, useState } from "react";

import { Geist, Playfair_Display } from "next/font/google";
import { usePathname } from "next/navigation";

import { ErrorPage } from "@/components/error-page";
import { Button } from "@/components/ui/button";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";

import type messages from "@/messages/en.json";

import "@/app/globals.css";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

const playfair = Playfair_Display({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
});

type ErrorText = (typeof messages)["GlobalError"];

/** Polish when the first path segment says so, otherwise English (the default locale). */
function localeFromPath(pathname: string): "en" | "pl" {
  return pathname.split("/")[1] === "pl" ? "pl" : "en";
}

/**
 * Global error boundary: reports the error and renders a fallback in the game's look. It
 * replaces the root layout, so there is no intl provider: once it renders, the text is loaded
 * from the message catalogue of the current path's locale. The catalogue stays out of the
 * start-up bundle because this boundary ships with every page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const locale = localeFromPath(usePathname());
  const [text, setText] = useState<ErrorText | null>(null);

  useMountEffect(() => {
    void (
      locale === "pl"
        ? import("@/messages/pl.json")
        : import("@/messages/en.json")
    )
      .then((catalogue) => {
        setText(catalogue.default.GlobalError);
        return null;
      })
      .catch(() => null); // Offline after the crash: the chunk cannot load, nothing else to show.
  });

  useEffect(() => {
    // Loaded on demand: this boundary ships with every page, the Sentry SDK should not.
    void import("@/lib/sentry-client")
      .then(({ reportClientError }) => {
        reportClientError(error);
        return null;
      })
      .catch(() => null); // Nothing left to report through when the reporter itself fails to load.
  }, [error]);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${playfair.variable} bg-background font-sans antialiased`}
      >
        {text ? (
          <ErrorPage description={text.description} title={text.title}>
            <Button onClick={reset} size="lg">
              {text.retry}
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={`/${locale}`}>{text.backToGame}</a>
            </Button>
          </ErrorPage>
        ) : null}
      </body>
    </html>
  );
}
