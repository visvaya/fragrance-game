'use client'

import { useEffect } from 'react'

export function SentryProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Import Sentry client config only in browser
        import('@/sentry.client.config')
    }, [])

    return <>{children}</>
}
