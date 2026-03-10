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
 *
 * @param eventName
 * @param properties
 * @param distinctId
 */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
  distinctId = "anon_user", // Fallback if no user ID provided
): Promise<void> {
  try {
    const client = getPostHogClient();
    client.capture({
      distinctId,
      event: eventName,
      properties,
    });
    // Ensure events are flushed immediately for serverless environments
    await client.shutdown();
  } catch (error) {
    // Sanitize error logging
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      "Failed to track event (sanitized):",
      errorMessage.replaceAll("\n", " "),
    );
  }
}

/**
 *
 * @param distinctId
 * @param properties
 */
export async function identifyUser(
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const client = getPostHogClient();
    client.identify({
      distinctId,
      properties: properties ?? {},
    });
    await client.shutdown();
  } catch (error) {
    // Sanitize error logging to prevent log injection
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      "Failed to identify user (sanitized):",
      errorMessage.replaceAll("\n", " "),
    );
  }
}
