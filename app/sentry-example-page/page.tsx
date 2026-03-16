"use client";

const throwError = () => {
  throw new Error("Sentry Test Error: Unhandled Exception");
};

export default function SentryExamplePage() {
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
    </div>
  );
}
