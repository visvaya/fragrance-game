'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Delay PostHog init to reduce TBT
        // Delay PostHog init to reduce TBT - wait for browser idle
        const handleInit = () => {
            posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
                api_host: '/ingest',
                ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || 'https://eu.posthog.com',
                person_profiles: 'identified_only',
                capture_pageview: false,
                loaded: (ph) => {
                    if (process.env.NODE_ENV === 'development') console.log('PostHog loaded', ph)
                }
            })
        }

        let timerId: any;
        // Use requestIdleCallback if available, otherwise fallback to timeout
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(handleInit, { timeout: 4000 })
        } else {
            timerId = setTimeout(handleInit, 2500)
        }

        return () => {
            if (timerId) clearTimeout(timerId)
        }
    }, [])

    return <PHProvider client={posthog}>{children}</PHProvider>
}
