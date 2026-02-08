'use client'

import { useEffect } from 'react'

export function SentryProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
                import('@/sentry.client.config')
            }, { timeout: 5000 })
        } else {
            // Fallback for Safari < 2023
            setTimeout(() => {
                import('@/sentry.client.config')
            }, 3000)
        }
    }, [])

    return <>{children}</>
}
