import "server-only";

import { PostHog } from "posthog-node";

import { env } from "@/lib/env";

// Initialize PostHog client
// Leveraging singleton pattern by module caching in Node.js
let posthogClient: PostHog | null = null;

function getPostHogClient() {
  // eslint-disable-next-line fp/no-mutation -- necessary for singleton pattern
  posthogClient ??= new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
  });
  return posthogClient;
}

/**
 * Tracks a server-side analytics event via posthog-node.
 * Uses captureImmediate() so the singleton client stays alive across multiple
 * calls within the same serverless invocation — preventing silent event loss
 * when trackEvent/identifyUser are called sequentially.
 */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
  distinctId = "anon_user",
): Promise<void> {
  try {
    const client = getPostHogClient();
    await client.captureImmediate({ distinctId, event: eventName, properties });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      "Failed to track event (sanitized):",
      errorMessage.replaceAll("\n", " "),
    );
  }
}

/**
 * Identifies a user in PostHog with optional properties.
 * Uses identifyImmediate() to keep the client alive for subsequent calls.
 */
export async function identifyUser(
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const client = getPostHogClient();
    await client.identifyImmediate({
      distinctId,
      properties: properties ?? {},
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      "Failed to identify user (sanitized):",
      errorMessage.replaceAll("\n", " "),
    );
  }
}
