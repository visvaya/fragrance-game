/** Minimal user shape needed to decide whether an auth change needs a full reload. */
type AuthChangeUser = {
  readonly id: string;
  readonly is_anonymous?: boolean;
};

/**
 * Decides whether an auth state change must reload the page instead of a soft refresh.
 *
 * A registered user signing in while the client was playing as a different user
 * (typically a guest) needs a full reload: a soft refresh keeps the previous
 * user's game state in the client and further moves fail.
 * @param previousUserId - id of the user the client was playing as, or null when unknown
 * @param event - Supabase auth event name
 * @param newUser - user carried by the event, or null
 * @returns true when the page should be reloaded
 */
export function shouldReloadOnAuthChange(
  previousUserId: string | null,
  event: string,
  newUser: AuthChangeUser | null,
): boolean {
  if (event !== "SIGNED_IN" || newUser === null) return false;
  if (newUser.is_anonymous === true) return false;
  if (previousUserId === null) return false;
  return previousUserId !== newUser.id;
}
