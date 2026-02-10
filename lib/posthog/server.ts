import { PostHog } from 'posthog-node'

/**
 *
 */
export function PostHogClient() {
    const posthogClient = new PostHog(
        process.env.NEXT_PUBLIC_POSTHOG_KEY!,
        {
            flushAt: 1,
            flushInterval: 0,
            host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'
        }
    )
    return posthogClient
}

/**
 *
 * @param root0
 * @param root0.distinctId
 * @param root0.event
 * @param root0.properties
 */
export async function trackEvent({
    distinctId,
    event,
    properties
}: {
    distinctId: string
    event: string
    properties?: Record<string, any>
}) {
    try {
        const client = PostHogClient()
        client.capture({
            distinctId,
            event,
            properties,
        })
        await client.shutdown()
    } catch (error) {
        console.error('Failed to track PostHog event:', error)
    }
}
