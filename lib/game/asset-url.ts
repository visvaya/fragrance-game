/** Configured asset host without surrounding whitespace. */
export function resolveAssetsHost(configured: string): string {
  return configured.trim();
}

/** Absolute HTTPS URL of an object key in the image bucket. */
export function assetUrl(key: string, configured: string): string {
  return `https://${resolveAssetsHost(configured)}/${key}`;
}
