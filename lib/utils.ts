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
