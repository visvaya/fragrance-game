/**
 *
 */
export default function NotFound() {
  // This page is a catch-all for invalid routes within the localized path.
  // It shouldn't contain much logic as it's just a 404.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404 - Not Found</h1>
      <p className="mt-2 text-lg">
        The page you are looking for does not exist.
      </p>
    </div>
  );
}
