"use client";

import { useState } from "react";

/**
 *
 */
export default function SentryExamplePage() {
  const [errorThrown, setErrorThrown] = useState(false);

  const throwError = () => {
    try {
      throw new Error("Sentry Test Error from Client Component");
    } catch {
      // In a real app, you might not catch it here to let Sentry catch unhandled errors,
      // or you explicitly capture it.
      // Sentry automatically catches unhandled exceptions.
      // To test unhandled:
      throw new Error("Sentry Test Error: Unhandled Exception");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-2xl font-bold">Sentry Verification</h1>
      <p>Click the button below to trigger an error.</p>
      <button
        className="rounded bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
        onClick={throwError}
      >
        Throw Error
      </button>
      {errorThrown ? <p className="text-red-500">Error thrown!</p> : null}
    </div>
  );
}
