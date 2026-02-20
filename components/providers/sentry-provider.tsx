"use client";

import { useEffect } from "react";

/**
 *
 * @param root0
 * @param root0.children
 */
async function initSentry() {
  await import("@/instrumentation-client");
}

/**
 *
 * @param root0
 * @param root0.children
 */
export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("requestIdleCallback" in globalThis) {
      (globalThis as any).requestIdleCallback(
        () => {
          void initSentry();
        },
        { timeout: 5000 },
      );
    } else {
      // Fallback for Safari < 2023
      setTimeout(() => {
        void initSentry();
      }, 3000);
    }
  }, []);

  return <>{children}</>;
}
