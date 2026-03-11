import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 *
 * @param inputs
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * No-op function — intentionally empty. Use where an event handler is required
 * for browser compatibility (e.g. iOS :active CSS state) but no action is needed.
 */
export const noop = (): undefined => undefined;

/**
 * Wraps an async call, returning null on any error instead of throwing.
 * Eliminates the need for mutable `let result = null; try { result = await fn() }` patterns.
 * @param asyncFunction - Async factory function to execute
 */
export async function safeCall<T>(asyncFunction: () => Promise<T>): Promise<T | null> {
  try {
    return await asyncFunction();
  } catch (error: unknown) {
    console.error("[safeCall]", error);
    return null;
  }
}

/**
 *
 * @param text
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .replaceAll("ł", "l")
    .replaceAll("ø", "o")
    .replaceAll("æ", "ae")
    .replaceAll("œ", "oe")
    .replaceAll("ß", "ss");
}
