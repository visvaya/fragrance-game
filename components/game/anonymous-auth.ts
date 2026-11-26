import type { createClient as CreateClientType } from "@/lib/supabase/client";
import { getSupabaseClient } from "@/lib/supabase/get-client";
import type { User } from "@supabase/supabase-js";

type SupabaseClient = ReturnType<typeof CreateClientType>;

/** Result of an anonymous sign-in attempt. */
export type AnonymousSignInResult =
  | { ok: true; user: User | null }
  | { message: string; ok: false };

const VERIFY_ATTEMPTS = 3;
const VERIFY_BASE_DELAY_MS = 50;

/**
 * Polls the Supabase client until the session from the sign-in is readable, with backoff.
 * @param supabase - Browser Supabase client.
 * @param attempt - Zero-based attempt number; callers leave it out.
 * @returns The signed-in user, or null when the session never became readable.
 */
export async function verifyAuthSession(
  supabase: SupabaseClient,
  attempt = 0,
): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session.user;
  if (attempt + 1 >= VERIFY_ATTEMPTS) return null;
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
  const user = await verifyAuthSession(supabase);
  if (user === null) {
    console.warn("[anonymous-auth] Session not readable after the sign-in.");
  }
  return { ok: true, user };
}

/**
 * Runs the anonymous sign-in and records it as the "eauxle.anon_auth" measure, which
 * e2e/performance/auth-waterfall.spec.ts budgets.
 * @param signIn - The sign-in request.
 * @returns The sign-in result.
 */
export async function measureAnonAuth<T>(signIn: () => Promise<T>): Promise<T> {
  performance.mark("eauxle:anon_auth_start");
  try {
    return await signIn();
  } finally {
    performance.mark("eauxle:anon_auth_end");
    performance.measure(
      "eauxle.anon_auth",
      "eauxle:anon_auth_start",
      "eauxle:anon_auth_end",
    );
  }
}

/**
 * Signs in with a Turnstile token; a thrown error becomes a rejected result.
 * @param token - Turnstile token.
 * @returns The sign-in result.
 */
export async function signInWithToken(
  token: string,
): Promise<AnonymousSignInResult> {
  try {
    const supabase = await getSupabaseClient();
    return await measureAnonAuth(async () =>
      signInAnonymousPlayer(supabase, token),
    );
  } catch (error) {
    return { message: String(error), ok: false };
  }
}
