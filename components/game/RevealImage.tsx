"use client"

import { useGame } from "./game-provider"
import Image from "next/image"

export function RevealImage() {
    const { dailyPerfume } = useGame()

    // No client-side blur opacity/filter logic needed anymore, 
    // because dailyPerfume.imageUrl is now the specific step variant from the server.

    return (
        <div className="relative aspect-square bg-muted border border-border overflow-hidden">
            <Image
                src={dailyPerfume.imageUrl || "/placeholder.svg"}
                alt="Mystery perfume bottle"
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-cover transition-all duration-700"
                priority
            />

            {/* Decorative corner marks */}
            <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-foreground/20" />
            <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-foreground/20" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-foreground/20" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-foreground/20" />
        </div>
    )
}
