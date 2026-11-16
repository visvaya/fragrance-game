import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { revokeSession } from "@/app/actions/auth-actions";
import { SessionCard } from "@/components/auth/session-card";

import SessionsPage from "../page";

vi.mock("@/app/actions/auth-actions", () => ({
  revokeSession: vi.fn(),
}));

vi.mock("@/components/auth/session-card", () => ({
  SessionCard: vi.fn(() => null),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-123" } } }),
    },
    from: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }],
      }),
      select: vi.fn().mockReturnThis(),
    }),
  }),
}));

describe("SessionsPage", () => {
  it("revokes a session with the shared action, which also ends the auth session", async () => {
    render(await SessionsPage());

    expect(vi.mocked(SessionCard).mock.lastCall?.[0].onRevoke).toBe(
      revokeSession,
    );
  });
});
