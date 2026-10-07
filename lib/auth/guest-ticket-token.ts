import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { GUEST_TICKET_CONFIG } from "./guest-ticket-config";

const VERSION = "v1";
const HKDF_INFO = "eauxle/guest-ticket/v1";
const KEY_LENGTH_BYTES = 32;

/**
 * Derives the ticket signing key from a server secret with HKDF-SHA256.
 * @param secret - Server-only secret (the service role key).
 * @returns 32-byte key used only for guest tickets.
 */
export function deriveGuestTicketKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", secret, "", HKDF_INFO, KEY_LENGTH_BYTES),
  );
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * Creates a signed ticket naming the guest account that played in this browser.
 * @param guestId - Anonymous user id taken from `auth.getUser()`.
 * @param issuedAtMs - Issue time in epoch milliseconds.
 * @param key - Key from `deriveGuestTicketKey`.
 * @returns Token `v1.<guestId>.<issuedAtMs>.<signature>`.
 */
export function createGuestTicket(
  guestId: string,
  issuedAtMs: number,
  key: Buffer,
): string {
  const id = z.uuid().parse(guestId);
  const payload = `${VERSION}.${id}.${String(Math.trunc(issuedAtMs))}`;
  return `${payload}.${sign(payload, key)}`;
}

/**
 * Verifies a ticket's signature, format and age.
 * @param token - Raw cookie value.
 * @param key - Key from `deriveGuestTicketKey`.
 * @param nowMs - Current time in epoch milliseconds.
 * @returns The guest id and issue time, or null for any invalid ticket.
 */
export function verifyGuestTicket(
  token: string,
  key: Buffer,
  nowMs: number,
): { guestId: string; issuedAtMs: number } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, guestId, issuedAtRaw, signature] = parts;
  if (version !== VERSION || !/^\d{1,16}$/.test(issuedAtRaw)) return null;
  if (!z.uuid().safeParse(guestId).success) return null;

  const expected = Buffer.from(
    sign(`${version}.${guestId}.${issuedAtRaw}`, key),
  );
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;

  const issuedAtMs = Number(issuedAtRaw);
  if (issuedAtMs > nowMs + GUEST_TICKET_CONFIG.clockSkewMs) return null;
  if (nowMs - issuedAtMs > GUEST_TICKET_CONFIG.maxAgeSeconds * 1000)
    return null;
  return { guestId, issuedAtMs };
}
