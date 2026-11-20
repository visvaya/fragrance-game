import type { createClient as CreateClientType } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type SupabaseClient = ReturnType<typeof CreateClientType>;

/** Result of an anonymous sign-in attempt. */
export type AnonymousSignInResult =
  | { ok: true; user: User | null; verified: boolean }
  | { message: string; ok: false };

const VERIFY_ATTEMPTS = 3;
const VERIFY_BASE_DELAY_MS = 50;

/**
 * Polls the Supabase client until the session from the sign-in is readable, with backoff.
 * @param supabase - Browser Supabase client.
 * @param attempt - Zero-based attempt number; callers leave it out.
 * @returns The signed-in user, and whether the session was confirmed.
 */
export async function verifyAuthSession(
  supabase: SupabaseClient,
  attempt = 0,
): Promise<{ user: User | null; verified: boolean }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return { user: session.user, verified: true };
  if (attempt + 1 >= VERIFY_ATTEMPTS) return { user: null, verified: false };
  await new Promise((resolve) =>
    setTimeout(resolve, VERIFY_BASE_DELAY_MS * Math.pow(2, attempt)),
  );
  return verifyAuthSession(supabase, attempt + 1);
}

/**
 * Signs the visitor in as an anonymous player in one request. With captcha protection on,
 * the Turnstile token goes with that first request; without a site key (local setups
 * without captcha) the request goes without one.
 * @param supabase - Browser Supabase client.
 * @param captchaToken - Turnstile token, or null when no captcha is configured.
 * @returns The signed-in user, or the error message from Supabase.
 */
export async function signInAnonymousPlayer(
  supabase: SupabaseClient,
  captchaToken: string | null,
): Promise<AnonymousSignInResult> {
  const { error } = await supabase.auth.signInAnonymously(
    captchaToken === null ? undefined : { options: { captchaToken } },
  );
  if (error) return { message: error.message, ok: false };
  const { user, verified } = await verifyAuthSession(supabase);
  return { ok: true, user, verified };
}
