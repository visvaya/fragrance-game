"use server";

import { revalidatePath } from "next/cache";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import {
  clearGuestTicket,
  readGuestTicket,
} from "@/lib/auth/guest-ticket-cookie";
import { checkRateLimit } from "@/lib/redis";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Postgres "invalid parameter value": the transfer can never succeed for this ticket. */
const INVALID_INPUT_CODE = "22023";

type MergeResult = { error: string } | { success: true };
type TransferMode = "merge" | "today_only";

const previewSchema = z.object({
  guest_games: z.number().int().min(0),
  today_moves: z.boolean(),
});

/** Returns the signed-in, non-anonymous account id, or null. */
async function getAccountId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous === true) {
    return null;
  }
  return user.id;
}

/**
 * Tells the signed-in account whether this browser holds guest games it may take over.
 * Ownership of the guest is proven only by the signed, httpOnly guest ticket cookie
 * issued when the guest made a move; no client-supplied id is accepted.
 * A ticket whose guest has no games is cleared. Lookup errors leave the ticket in
 * place and report nothing pending, so the next visit can try again.
 */
export async function getPendingGuestMerge(): Promise<
  { pending: false } | { pending: true; todayMoves: boolean }
> {
  const accountId = await getAccountId();
  if (accountId === null) {
    return { pending: false };
  }
  const ticket = await readGuestTicket();
  if (ticket === null) {
    // A stale hint would otherwise make every page load ask again.
    await clearGuestTicket();
    return { pending: false };
  }

  const { data, error } = await createAdminClient().rpc("guest_merge_preview", {
    p_account_id: accountId,
    p_guest_id: ticket.guestId,
  });
  const parsed = error ? null : previewSchema.safeParse(data);
  if (parsed?.success !== true) {
    Sentry.captureException(new Error("Guest merge preview failed"), {
      extra: { dbCode: error?.code },
    });
    return { pending: false };
  }

  if (parsed.data.guest_games === 0) {
    await clearGuestTicket();
    return { pending: false };
  }
  return { pending: true, todayMoves: parsed.data.today_moves };
}

/** Shared body of merge and decline: the ticket is the only proof of the guest. */
async function transferGuestGames(mode: TransferMode): Promise<MergeResult> {
  const accountId = await getAccountId();
  if (accountId === null) {
    return { error: "Not signed in" };
  }
  await checkRateLimit("guestMerge", accountId);

  const ticket = await readGuestTicket();
  if (ticket === null) {
    return { error: "No guest games" };
  }

  const { error } = await createAdminClient().rpc("transfer_guest_games", {
    p_account_id: accountId,
    p_guest_id: ticket.guestId,
    p_mode: mode,
  });
  if (error) {
    Sentry.captureException(new Error("Guest merge failed"), {
      extra: { dbCode: error.code, mode },
    });
    // Source not a guest, target anonymous or the same player: retrying cannot succeed.
    // Any other error keeps the ticket so the player can retry.
    if (error.code === INVALID_INPUT_CODE) {
      await clearGuestTicket();
    }
    return { error: "Transfer failed" };
  }

  await clearGuestTicket();
  revalidatePath("/");
  return { success: true };
}

/**
 * Moves all games of the guest named by the signed guest ticket cookie to the signed-in
 * account. The guest id never comes from the client, so only the browser that played as
 * that guest can claim its games. Clears the ticket on success.
 */
export async function mergeGuestGames(): Promise<MergeResult> {
  return transferGuestGames("merge");
}

/**
 * Declines the merge: only today's game of the guest (proven by the signed ticket
 * cookie) moves to the account, so declining cannot reset today's attempts.
 * Clears the ticket on success.
 */
export async function declineGuestMerge(): Promise<MergeResult> {
  return transferGuestGames("today_only");
}
