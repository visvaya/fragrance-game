"use client"

import { ReactNode, useEffect } from "react"
import Lenis from "lenis"

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        const lenis = new Lenis({
            lerp: 0.08,
            // duration: 1.2,
            // easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
            wheelMultiplier: 0.8,
            touchMultiplier: 1.5,
        })

        function raf(time: number) {
            lenis.raf(time)
            requestAnimationFrame(raf)
        }

        requestAnimationFrame(raf)

        return () => {
            lenis.destroy()
        }
    }, [])

    return <>{children}</>
}
