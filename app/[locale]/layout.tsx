import type React from "react";

import { Geist, Geist_Mono, Playfair_Display, Caveat } from "next/font/google";
import { notFound } from "next/navigation";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, getMessages } from "next-intl/server";

import { AuthErrorWatcher } from "@/components/auth/auth-error-watcher";
import { UIPreferencesProvider } from "@/components/game/contexts/ui-preferences-context";
import { AnalyticsProviders } from "@/components/providers/analytics-providers";
import { SmoothScrollProvider } from "@/components/providers/smooth-scroll-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routing } from "@/i18n/routing";

import type { Viewport } from "next";
import "@/app/globals.css";

const geistSans = Geist({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
});

const playfair = Playfair_Display({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
});

const caveat = Caveat({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-caveat",
  weight: ["400", "500", "600", "700"],
});

/**
 * Generuje metadane dla strony.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    description: t("description"),
    icons: {
      apple: "/apple-icon.png",
      icon: [
        {
          media: "(prefers-color-scheme: light)",
          url: "/icon-light-32x32.png",
        },
        {
          media: "(prefers-color-scheme: dark)",
          url: "/icon-dark-32x32.png",
        },
        {
          type: "image/svg+xml",
          url: "/icon.svg",
        },
      ],
    },
    keywords: ["perfume", "fragrance", "game", "wordle", "puzzle", "olfactory"], // Keywords often kept English or hybrid, but could be localized too
    title: t("title"),
  };
}

/**
 *
 */
export async function generateViewport({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Viewport> {
  await params; // Ensure it's awaited for Next.js 16 compliance
  return {
    initialScale: 1,
    interactiveWidget: "resizes-content",
    themeColor: [
      { color: "#FDFBF7", media: "(prefers-color-scheme: light)" },
      { color: "#1F1F22", media: "(prefers-color-scheme: dark)" },
    ],
    viewportFit: "cover",
    width: "device-width",
  };
}

/**
 * Główny layout aplikacji.
 */
export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale || routing.defaultLocale} suppressHydrationWarning>
      <head>
        {/* Blocking script: sets data-layout="wide" on <html> before first paint,
            eliminating the narrow→wide flash on desktop screens. Runs synchronously
            during <head> parsing, before the browser renders any body content. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem('fragrance-game-layout');if(l==='wide'||(!l&&window.innerWidth>=1024)){document.documentElement.setAttribute('data-layout','wide')}}catch(e){}`,
          }}
        />
        {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
          <link
            crossOrigin="anonymous"
            href={process.env.NEXT_PUBLIC_SUPABASE_URL}
            rel="preconnect"
          />
        ) : null}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${caveat.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages}>
          <AnalyticsProviders>
            <UIPreferencesProvider>
              <SmoothScrollProvider>
                <TooltipProvider delayDuration={300}>
                  {children}
                </TooltipProvider>
                <AuthErrorWatcher />
                <Toaster />
              </SmoothScrollProvider>
            </UIPreferencesProvider>
          </AnalyticsProviders>
          <Analytics />
          <SpeedInsights />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
