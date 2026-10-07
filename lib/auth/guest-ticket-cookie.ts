import "server-only";

import { cookies } from "next/headers";

import { env } from "@/lib/env";

import { GUEST_TICKET_CONFIG } from "./guest-ticket-config";
import {
  createGuestTicket,
  deriveGuestTicketKey,
  verifyGuestTicket,
} from "./guest-ticket-token";

function ticketKey(): Buffer {
  return deriveGuestTicketKey(env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Read when a cookie is set, not at import, so importing modules never touch env. */
function baseOptions() {
  return {
    maxAge: GUEST_TICKET_CONFIG.maxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  } as const;
}

/**
 * Stores proof that this browser played as the given guest. Call only from a server
 * action, with the id of an anonymous user from `auth.getUser()`.
 * @param guestId - Anonymous user id.
 */
export async function issueGuestTicket(guestId: string): Promise<void> {
  const store = await cookies();
  store.set(
    GUEST_TICKET_CONFIG.ticketCookieName,
    createGuestTicket(guestId, Date.now(), ticketKey()),
    { ...baseOptions(), httpOnly: true },
  );
  // The hint carries no id: it only tells the client that asking the server is worthwhile.
  store.set(GUEST_TICKET_CONFIG.hintCookieName, "1", {
    ...baseOptions(),
    httpOnly: false,
  });
}

/**
 * Reads and verifies the guest ticket of this browser.
 * @returns The guest id and issue time, or null when absent or invalid.
 */
export async function readGuestTicket(): Promise<{
  guestId: string;
  issuedAtMs: number;
} | null> {
  const store = await cookies();
  const value = store.get(GUEST_TICKET_CONFIG.ticketCookieName)?.value;
  return value === undefined
    ? null
    : verifyGuestTicket(value, ticketKey(), Date.now());
}

/**
 * Issues the ticket only when this browser has none for this guest or the one it has is
 * older than the refresh threshold. Setting a cookie in a server action makes Next.js
 * render the page again, so this writes at most once per threshold per guest, and the
 * merge offer stays valid for the ticket lifetime minus the threshold after the last move.
 * @param guestId - Anonymous user id from `auth.getUser()`, after a move was written.
 */
export async function ensureGuestTicket(guestId: string): Promise<void> {
  const current = await readGuestTicket();
  const refreshAfterMs = GUEST_TICKET_CONFIG.refreshAfterSeconds * 1000;
  if (
    current?.guestId === guestId &&
    Date.now() - current.issuedAtMs < refreshAfterMs
  ) {
    return;
  }
  await issueGuestTicket(guestId);
}

/** Removes the ticket and the hint, after a merge decision or when nothing is left to merge. */
export async function clearGuestTicket(): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_TICKET_CONFIG.ticketCookieName);
  store.delete(GUEST_TICKET_CONFIG.hintCookieName);
}
