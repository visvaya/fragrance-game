import type React from "react";

import { Geist, Geist_Mono, Playfair_Display, Caveat } from "next/font/google";
import { notFound } from "next/navigation";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, getMessages } from "next-intl/server";

import { AnalyticsProviders } from "@/components/providers/analytics-providers";
import { SmoothScrollProvider } from "@/components/providers/smooth-scroll-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routing } from "@/i18n/routing";

import type { Viewport } from "next";
import "@/app/globals.css";

/**
 * Geist Sans - główny font body (zgodnie z project-rules)
 */
const geistSans = Geist({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

/**
 * Geist Mono - font dla kodu
 */
const geistMono = Geist_Mono({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
});

/**
 * Playfair Display - elegancki font dla nagłówków (zgodnie z project-rules)
 */
const playfair = Playfair_Display({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
});

/**
 * Caveat - font odręczny dla akcentów (zgodnie z project-rules)
 * Using "optional" display for non-critical accent font
 */
const caveat = Caveat({
  display: "optional",
  preload: false,
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
  if (!routing.locales.includes(locale as "pl" | "en")) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale || "en"} suppressHydrationWarning>
      <head>
        {/* Preconnect to external services */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
          <link
            crossOrigin="anonymous"
            href={process.env.NEXT_PUBLIC_SUPABASE_URL}
            rel="preconnect"
          />
        ) : null}

        {/* Font preloading handled automatically by Next.js font optimization */}
        {/* Critical fonts (Geist Sans, Playfair) have preload:true above */}
        {/* Caveat uses display:"optional" to prevent FOIT without blocking render */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${caveat.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages}>
          <AnalyticsProviders>
            <SmoothScrollProvider>
              <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            </SmoothScrollProvider>
          </AnalyticsProviders>
          <Analytics />
          <SpeedInsights />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
