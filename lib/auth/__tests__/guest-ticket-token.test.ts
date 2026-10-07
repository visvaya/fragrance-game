import { describe, expect, it } from "vitest";

import { GUEST_TICKET_CONFIG } from "../guest-ticket-config";
import {
  createGuestTicket,
  deriveGuestTicketKey,
  verifyGuestTicket,
} from "../guest-ticket-token";

const KEY = deriveGuestTicketKey("test-secret");
const OTHER_KEY = deriveGuestTicketKey("other-secret");
const GUEST = "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const NOW = 1_780_000_000_000;
const MAX_AGE_MS = GUEST_TICKET_CONFIG.maxAgeSeconds * 1000;

describe("guest ticket token", () => {
  it("round-trips a valid ticket", () => {
    const token = createGuestTicket(GUEST, NOW, KEY);
    expect(verifyGuestTicket(token, KEY, NOW + 1000)).toEqual({
      guestId: GUEST,
      issuedAtMs: NOW,
    });
  });

  it("rejects a ticket signed with another key", () => {
    expect(
      verifyGuestTicket(createGuestTicket(GUEST, NOW, OTHER_KEY), KEY, NOW),
    ).toBeNull();
  });

  it("rejects a ticket whose guest id was swapped", () => {
    const [v, , issued, sig] = createGuestTicket(GUEST, NOW, KEY).split(".");
    const forged = [
      v,
      "00000000-0000-4000-8000-000000000000",
      issued,
      sig,
    ].join(".");
    expect(verifyGuestTicket(forged, KEY, NOW)).toBeNull();
  });

  it("rejects an expired ticket and accepts one at the limit", () => {
    const token = createGuestTicket(GUEST, NOW, KEY);
    expect(verifyGuestTicket(token, KEY, NOW + MAX_AGE_MS)).not.toBeNull();
    expect(verifyGuestTicket(token, KEY, NOW + MAX_AGE_MS + 1)).toBeNull();
  });

  it("rejects a ticket issued in the future beyond clock skew", () => {
    const token = createGuestTicket(
      GUEST,
      NOW + GUEST_TICKET_CONFIG.clockSkewMs + 1,
      KEY,
    );
    expect(verifyGuestTicket(token, KEY, NOW)).toBeNull();
  });

  it.each([
    "",
    "v1",
    "v1.a.b",
    "v2.x.1.y",
    `v1.${GUEST}.abc.sig`,
    `v1.not-a-uuid.${NOW}.sig`,
    `v1.${GUEST}.${NOW}.`,
    `v1.${GUEST}.${NOW}.sig.extra`,
  ])("rejects malformed token %j", (token) => {
    expect(verifyGuestTicket(token, KEY, NOW)).toBeNull();
  });

  it("throws when creating a ticket for a non-uuid id", () => {
    expect(() => createGuestTicket("nope", NOW, KEY)).toThrow();
  });
});
