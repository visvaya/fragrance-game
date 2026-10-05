import type React from "react";

import type { Metadata } from "next";

/**
 * Keeps sign-in, registration, password and session pages out of search
 * results and drops the canonical link inherited from the locale layout,
 * which points at the home page.
 */
export const metadata: Metadata = {
  alternates: null,
  robots: { follow: false, index: false },
};

/** Pass-through layout that only scopes the metadata above to `/auth/*`. */
export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactNode {
  return children;
}
