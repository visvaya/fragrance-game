"use server";

import { z } from "zod";

import { COMMON_PASSWORDS } from "@/lib/constants/common-passwords";

// Build a Set for O(1) lookups — case-sensitive, matching passwords as-is
const COMMON_PASSWORDS_SET = new Set(COMMON_PASSWORDS);

const passwordInputSchema = z.string().min(1).max(128);

/**
 * Server Action to check if a password is too common.
 * Runs server-side to avoid sending the full blacklist to the client.
 * @param password - The password to validate.
 * @returns `{ isSafe: true }` if the password is acceptable, or `{ isSafe: false }` if it is too common.
 */
export async function validatePasswordSafety(
  password: string,
): Promise<{ isSafe: boolean }> {
  await Promise.resolve();
  const parsed = passwordInputSchema.safeParse(password);
  if (!parsed.success) {
    return { isSafe: false };
  }

  const isSafe = !COMMON_PASSWORDS_SET.has(parsed.data);
  return { isSafe };
}
