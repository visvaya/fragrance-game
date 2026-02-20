"use client";

import { useEffect } from "react";

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
          import("@/instrumentation-client");
        },
        { timeout: 5000 },
      );
    } else {
      // Fallback for Safari < 2023
      setTimeout(() => {
        import("@/instrumentation-client");
      }, 3000);
    }
  }, []);

  return <>{children}</>;
}
