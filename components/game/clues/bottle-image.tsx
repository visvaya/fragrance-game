"use client"

import { useGame } from "../game-provider"
import Image from "next/image"

export function BottleImage() {
  const { getBlurLevel, dailyPerfume, gameState } = useGame()
  const blurLevel = getBlurLevel()
  const grayscale = blurLevel > 0 ? 100 : 0

  return (
    <div className="relative aspect-square bg-muted border border-border overflow-hidden">
      <Image
        src={dailyPerfume.imageUrl || "/placeholder.svg"}
        alt="Mystery perfume bottle"
        fill
        className="object-cover transition-all duration-700"
        style={{
          filter: gameState !== "playing" ? "blur(0px) grayscale(0%)" : `blur(${blurLevel}px) grayscale(${grayscale}%)`,
          opacity: 0.9,
        }}
      />

      {/* Decorative corner marks */}
      <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-foreground/20" />
      <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-foreground/20" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-foreground/20" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-foreground/20" />
    </div>
  )
}
