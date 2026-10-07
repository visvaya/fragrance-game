/** Public host of the game image bucket used when NEXT_PUBLIC_ASSETS_HOST is not set. */
export const DEFAULT_ASSETS_HOST =
  "pub-2c37ff9f03ea40878492e7f72ef83fe3.r2.dev";

/** Configured asset host; an empty or whitespace value counts as unset. */
export function resolveAssetsHost(configured: string | undefined): string {
  const trimmed = configured?.trim() ?? "";
  return trimmed === "" ? DEFAULT_ASSETS_HOST : trimmed;
}

/** Absolute HTTPS URL of an object key in the image bucket. */
export function assetUrl(key: string, configured: string | undefined): string {
  return `https://${resolveAssetsHost(configured)}/${key}`;
}
