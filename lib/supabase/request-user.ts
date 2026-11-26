import type { AuthError, User } from "@supabase/supabase-js";

import { createClient } from "./server";

/** What {@link getRequestUser} returns. */
type RequestUser = {
  error: AuthError | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
};

/**
 * The user of this request, checked with the auth server, with the client that read it.
 * `user` is null when the visitor is signed out or the check failed; `error` says which.
 * @returns The request's Supabase client, its user and the auth error, if any.
 */
export async function getRequestUser(): Promise<RequestUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { error, supabase, user };
}
