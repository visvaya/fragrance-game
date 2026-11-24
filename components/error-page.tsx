import type { ReactNode } from "react";

/**
 * Full-page notice for the 404 page and the global error boundary: wordmark, heading,
 * description and the actions passed as children. Needs no providers, so it renders even
 * when the root layout does not.
 */
export function ErrorPage({
  children,
  description,
  title,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly title: string;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="font-[family-name:var(--font-playfair)] text-2xl font-semibold tracking-tight text-foreground lowercase">
        Eauxle
      </p>
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-semibold text-balance text-foreground lining-nums sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {children}
      </div>
    </main>
  );
}
