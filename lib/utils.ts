import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 *
 * @param inputs
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
