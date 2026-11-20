"use client";

// eslint-disable-next-line no-restricted-imports -- error boundary: captures error prop changes via Sentry
import { useEffect } from "react";

import Error from "next/error";

/** Global error boundary – captures unhandled errors via Sentry and renders a fallback UI. */
export default function GlobalError({
  error,
}: {
  readonly error: Error & { digest?: string };
}) {
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
    <html lang="en">
      <body>
        <Error statusCode={500} title="Error" />
      </body>
    </html>
  );
}
