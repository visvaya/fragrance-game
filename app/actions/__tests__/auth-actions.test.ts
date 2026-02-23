import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Import after mocks
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { revokeAllSessions } from "../auth-actions";

describe("auth-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("revokeAllSessions", () => {
    describe("success cases", () => {
      it("successfully signs out authenticated user", async () => {
        // Mock Supabase client with authenticated user
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { email: "test@example.com", id: "user-123" } },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        expect(result).toEqual({ success: true });
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(1);
        expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
      });

      it("revalidates root path after successful sign out", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await revokeAllSessions();

        expect(revalidatePath).toHaveBeenCalledWith("/");
        expect(revalidatePath).toHaveBeenCalledTimes(1);
      });

      it("handles users with different authentication providers", async () => {
        const authProviders = [
          { id: "user-google-123", provider: "google" },
          { id: "user-github-456", provider: "github" },
          { id: "user-email-789", provider: "email" },
        ];

        for (const { id, provider } of authProviders) {
          vi.clearAllMocks();

          const mockSupabaseClient = {
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: {
                  user: {
                    app_metadata: { provider },
                    id,
                  },
                },
                error: null,
              }),
              signOut: vi
                .fn()
                .mockResolvedValue({ error: null })
                .mockResolvedValue({ error: null }),
            },
          };

          vi.mocked(createClient).mockResolvedValue(
            mockSupabaseClient as never,
          );

          const result = await revokeAllSessions();

          expect(result).toEqual({ success: true });
          expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
        }
      });
    });

    describe("authentication errors", () => {
      it("returns error when user is not authenticated", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
            signOut: vi.fn().mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        expect(result).toEqual({ error: "Not authenticated" });
        expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it("returns error when getUser fails with error", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: { message: "JWT expired", status: 401 },
            }),
            signOut: vi.fn().mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        expect(result).toEqual({ error: "Not authenticated" });
        expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
      });

      it("returns error when user object is undefined", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: {},
              error: null,
            }),
            signOut: vi.fn().mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        expect(result).toEqual({ error: "Not authenticated" });
        expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
      });
    });

    describe("sign out errors", () => {
      it("returns error when signOut fails", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({
                error: { message: "Failed to sign out", status: 500 },
              }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        expect(result).toEqual({ error: "Failed to sign out" });
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it("handles network timeout during sign out", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({
                error: { message: "Network request timeout", status: 408 },
              }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        expect(result).toEqual({ error: "Network request timeout" });
      });

      it("handles database connection errors during sign out", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({
                error: { message: "Database connection failed", status: 503 },
              }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        expect(result).toEqual({ error: "Database connection failed" });
      });
    });

    describe("edge cases", () => {
      it("handles Supabase client creation failure", async () => {
        vi.mocked(createClient).mockRejectedValue(
          new Error("Failed to create Supabase client"),
        );

        await expect(revokeAllSessions()).rejects.toThrow(
          "Failed to create Supabase client",
        );
      });

      it("does not revalidate path on authentication error", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: { message: "Not authenticated" },
            }),
            signOut: vi.fn().mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await revokeAllSessions();

        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it("does not revalidate path on sign out error", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({
                error: { message: "Sign out failed" },
              }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await revokeAllSessions();

        expect(revalidatePath).not.toHaveBeenCalled();
      });
    });

    describe("security considerations", () => {
      it("always checks authentication before attempting sign out", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        await revokeAllSessions();

        // getUser should be called before signOut
        const getUserCallOrder =
          mockSupabaseClient.auth.getUser.mock.invocationCallOrder[0];
        const signOutCallOrder =
          mockSupabaseClient.auth.signOut.mock.invocationCallOrder[0];

        expect(getUserCallOrder).toBeLessThan(signOutCallOrder);
      });

      it("prevents sign out attempts without valid user session", async () => {
        const invalidSessions = [
          { data: { user: null }, error: null },
          { data: {}, error: null },
          { data: { user: null }, error: { message: "Invalid token" } },
        ];

        for (const session of invalidSessions) {
          vi.clearAllMocks();

          const mockSupabaseClient = {
            auth: {
              getUser: vi.fn().mockResolvedValue(session),
              signOut: vi.fn().mockResolvedValue({ error: null }),
            },
          };

          vi.mocked(createClient).mockResolvedValue(
            mockSupabaseClient as never,
          );

          await revokeAllSessions();

          expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
        }
      });

      it("handles session hijacking attempt (expired/invalid user)", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: { message: "JWT verification failed", status: 401 },
            }),
            signOut: vi.fn().mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        expect(result).toEqual({ error: "Not authenticated" });
        expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
      });
    });

    describe("integration scenarios", () => {
      it("successfully completes full sign out flow", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: {
                user: {
                  created_at: "2024-01-01T00:00:00Z",
                  email: "user@example.com",
                  id: "user-123",
                },
              },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        const result = await revokeAllSessions();

        // Verify complete flow
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith("/");
        expect(result).toEqual({ success: true });
      });

      it("simulates concurrent sign out attempts (idempotent)", async () => {
        const mockSupabaseClient = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: "user-123" } },
              error: null,
            }),
            signOut: vi
              .fn()
              .mockResolvedValue({ error: null })
              .mockResolvedValue({ error: null }),
          },
        };

        vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as never);

        // Multiple concurrent calls
        const results = await Promise.all([
          revokeAllSessions(),
          revokeAllSessions(),
          revokeAllSessions(),
        ]);

        for (const result of results) {
          expect(result).toEqual({ success: true });
        }
      });
    });
  });
});
