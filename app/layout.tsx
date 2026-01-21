import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Playfair_Display, Caveat } from "next/font/google"
import { PostHogProvider } from "@/components/providers/posthog-provider"
import { SentryProvider } from "@/components/providers/sentry-provider"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

/**
 * Geist Sans - główny font body (zgodnie z project-rules)
 */
const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
})

/**
 * Geist Mono - font dla kodu
 */
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

/**
 * Playfair Display - elegancki font dla nagłówków (zgodnie z project-rules)
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})

/**
 * Caveat - font odręczny dla akcentów (zgodnie z project-rules)
 */
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-caveat",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Eauxle — Olfactory Deduction",
  description: "A daily fragrance guessing game. Deduce the mystery perfume from evolving clues.",
  keywords: ["perfume", "fragrance", "game", "wordle", "puzzle", "olfactory"],
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#FDFBF7",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${caveat.variable} font-sans antialiased`}>
        <SentryProvider>
          <PostHogProvider>
            {children}
          </PostHogProvider>
        </SentryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
