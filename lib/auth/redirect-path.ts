/**
 * Path to open after an auth callback, from its `next` parameter. Only a same-site path is
 * accepted (one leading slash, not two), so the callback cannot redirect to another site.
 * @param searchParams - Query parameters of the callback URL.
 * @returns The `next` path, or "/" when it is missing or not a same-site path.
 */
export function redirectPathFrom(searchParams: URLSearchParams): string {
  const next = searchParams.get("next") ?? "/";
  return /^\/(?!\/)/.test(next) ? next : "/";
}
