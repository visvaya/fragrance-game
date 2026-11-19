import { notFound } from "next/navigation";

/**
 * Unknown paths under a locale render the locale's not-found page inside the root layout,
 * per request and with the CSP nonce, instead of the prebuilt framework 404 whose scripts the
 * nonce-based policy blocks.
 */
export default function CatchAllPage(): never {
  notFound();
}
