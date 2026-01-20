import { PostHog } from 'posthog-node'

// Initialize PostHog client
// Leveraging singleton pattern by module caching in Node.js
let posthogClient: PostHog | null = null

function getPostHogClient() {
    if (!posthogClient) {
        posthogClient = new PostHog(
            process.env.NEXT_PUBLIC_POSTHOG_KEY!,
            { host: process.env.NEXT_PUBLIC_POSTHOG_HOST }
        )
    }
    return posthogClient
}

export async function trackEvent(
    eventName: string,
    properties?: Record<string, any>,
    distinctId: string = 'anon_user' // Fallback if no user ID provided
) {
    try {
        const client = getPostHogClient()
        client.capture({
            distinctId,
            event: eventName,
            properties,
        })
        // Ensure events are flushed immediately for serverless environments
        await client.shutdown()
    } catch (error) {
        console.error('Failed to track event:', error)
    }
}

export async function identifyUser(
    distinctId: string,
    properties?: Record<string, any>
) {
    try {
        const client = getPostHogClient()
        client.identify({
            distinctId,
            properties: properties || {},
        })
        await client.shutdown()
    } catch (error) {
        console.error('Failed to identify user:', error)
    }
}
