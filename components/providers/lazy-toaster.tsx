"use client";

import dynamic from "next/dynamic";

const Toaster = dynamic(
  async () =>
    import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })),
  { ssr: false },
);

/** Lazily loads the Toaster notification component client-side only (no SSR). */
export function LazyToaster() {
  return <Toaster />;
}
