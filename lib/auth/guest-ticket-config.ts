/** Names and lifetimes of the cookies that prove which guest played in this browser. */
export const GUEST_TICKET_CONFIG = {
  clockSkewMs: 300_000,
  hintCookieName: "eauxle_guest_hint",
  maxAgeSeconds: 2_592_000,
  /** A valid ticket older than this is issued again on the next move. */
  refreshAfterSeconds: 604_800,
  ticketCookieName: "eauxle_guest_ticket",
} as const;
