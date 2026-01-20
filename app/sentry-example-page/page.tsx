"use client";

import { useState } from "react";

export default function SentryExamplePage() {
    const [errorThrown, setErrorThrown] = useState(false);

    const throwError = () => {
        try {
            throw new Error("Sentry Test Error from Client Component");
        } catch (e) {
            // In a real app, you might not catch it here to let Sentry catch unhandled errors,
            // or you explicitly capture it.
            // Sentry automatically catches unhandled exceptions.
            // To test unhandled:
            throw new Error("Sentry Test Error: Unhandled Exception");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-8">
            <h1 className="text-2xl font-bold">Sentry Verification</h1>
            <p>Click the button below to trigger an error.</p>
            <button
                onClick={throwError}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
                Throw Error
            </button>
            {errorThrown && <p className="text-red-500">Error thrown!</p>}
        </div>
    );
}
