/**
 * Minimal layout for Sentry example page (required by Next.js Webpack build).
 */
export default function SentryExampleLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
