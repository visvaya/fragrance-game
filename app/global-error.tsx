"use client";

import { useEffect } from "react";

import Error from "next/error";

import * as Sentry from "@sentry/nextjs";

/** Global error boundary — captures unhandled errors via Sentry and renders a fallback UI. */
export default function GlobalError({
  error,
}: {
  readonly error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <Error statusCode={500} title="Error" />
      </body>
    </html>
  );
}
