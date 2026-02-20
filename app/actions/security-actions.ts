"use server";

import { COMMON_PASSWORDS } from "@/lib/constants/common-passwords";

// Build a Set for O(1) lookups (case-insensitive: normalize both sides to lowercase)
const COMMON_PASSWORDS_SET = new Set(COMMON_PASSWORDS);

/**
 * Server Action to check if a password is too common.
 * Runs server-side to avoid sending the full blacklist to the client.
 * @param password - The password to validate.
 * @returns `{ isSafe: true }` if the password is acceptable, or `{ isSafe: false }` if it is too common.
 */
export async function validatePasswordSafety(
  password: string,
): Promise<{ isSafe: boolean }> {
  const isSafe = !COMMON_PASSWORDS_SET.has(password);
  return { isSafe };
}
