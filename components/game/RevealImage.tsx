
"use client"

import { useGame } from "./game-provider"
import Image from "next/image"
import { useState, useEffect } from "react"
import { ScanEye } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

export function RevealImage() {
    const { dailyPerfume, uiPreferences } = useGame()
    const t = useTranslations('RevealImage')
    const targetSrc = dailyPerfume.imageUrl || "/placeholder.svg"

    // STATE:
    // - activeSrc: The image currently fully visible (or fading out conceptually)
    // - fadingInSrc: The new image appearing on top. Null if no transition.
    // - isLoaded: heavy lifting for the opacity switch
    const [activeSrc, setActiveSrc] = useState(targetSrc)
    const [fadingInSrc, setFadingInSrc] = useState<string | null>(null)
    const [isFadingInLoaded, setIsFadingInLoaded] = useState(false)

    // Effect: Detect change in targetSrc -> Start Transition
    // Logic: When target changes, it becomes 'fadingInSrc'. We keep the old 'activeSrc' visible behind.
    useEffect(() => {
        if (targetSrc !== activeSrc && targetSrc !== fadingInSrc) {
            setFadingInSrc(targetSrc)
            setIsFadingInLoaded(false)
        }
    }, [targetSrc, activeSrc, fadingInSrc])

    // Callback: When new image finishes loading
    const handleImageLoad = () => {
        setIsFadingInLoaded(true)

        // Wait for the CSS transition (e.g. 700ms) to complete visually, then swap buffers
        const timeout = setTimeout(() => {
            if (fadingInSrc) {
                setActiveSrc(fadingInSrc)
                setFadingInSrc(null)
                setIsFadingInLoaded(false)
            }
        }, 700) // Match duration-700

        return () => clearTimeout(timeout)
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center gap-2 mb-4">
                <ScanEye className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-[family-name:var(--font-playfair)] text-lg text-foreground tracking-wide">
                    {t('visualEvidence')}
                </h2>
            </div>

            <div className="flex flex-col items-center justify-center flex-1 gap-4">
                <div className={cn(
                    "relative aspect-square w-[80%] md:w-full bg-muted border border-border overflow-hidden rounded-md transition-all duration-300 dark:brightness-[0.85]",
                    uiPreferences.fontScale === 'large' ? "max-w-[280px]" : "max-w-[240px]"
                )}>

                    {/* Layer 1: Active Image (Background) */}
                    {/* Always present. If nothing else, shows placeholder. */}
                    <Image
                        key={activeSrc}
                        src={activeSrc}
                        alt={t('altBase')}
                        fill
                        sizes="(max-width: 768px) 100vw, 40vw"
                        className="object-cover transition-transform duration-700 ease-in-out hover:scale-110"
                        priority
                    />

                    {/* Layer 2: Fading In Image (Foreground) */}
                    {/* Only rendered when we have a new source pending */}
                    {fadingInSrc && (
                        <Image
                            key={fadingInSrc}
                            src={fadingInSrc}
                            alt={t('altReveal')}
                            fill
                            sizes="(max-width: 768px) 100vw, 40vw"
                            className={`object-cover transition-all duration-700 ease-in-out hover:scale-110 ${isFadingInLoaded ? "opacity-100" : "opacity-0"
                                }`}
                            onLoad={handleImageLoad}
                            priority
                        />
                    )}

                    {/* Decorative corner marks (always on top) */}
                    <div className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-foreground/20" />
                    <div className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-foreground/20" />
                    <div className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-foreground/20" />
                    <div className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-foreground/20" />
                </div>


            </div>
        </div>
    )
}
