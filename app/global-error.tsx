"use client";

// eslint-disable-next-line no-restricted-imports -- error boundary: captures error prop changes via Sentry
import { useEffect } from "react";

import { Geist, Playfair_Display } from "next/font/google";
import { usePathname } from "next/navigation";

import { ErrorPage } from "@/components/error-page";
import { Button } from "@/components/ui/button";
import { GlobalError as enText } from "@/messages/en.json";
import { GlobalError as plText } from "@/messages/pl.json";

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

const TEXT = { en: enText, pl: plText } as const;

/** Polish when the first path segment says so, otherwise English (the default locale). */
function localeFromPath(pathname: string): keyof typeof TEXT {
  return pathname.split("/")[1] === "pl" ? "pl" : "en";
}

/**
 * Global error boundary: reports the error and renders a fallback in the game's look. It
 * replaces the root layout, so there is no intl provider: the text comes straight from the
 * message catalogues, in the locale of the current path.
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const locale = localeFromPath(usePathname());
  const text = TEXT[locale];

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
        <ErrorPage description={text.description} title={text.title}>
          <Button onClick={reset} size="lg">
            {text.retry}
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`/${locale}`}>{text.backToGame}</a>
          </Button>
        </ErrorPage>
      </body>
    </html>
  );
}
