"use client"

import { X } from "lucide-react"

interface StatsModalProps {
  open: boolean
  onClose: () => void
}

// Sample stats data
const STATS = {
  played: 12,
  winPercent: 83,
  currentStreak: 4,
  maxStreak: 9,
  distribution: [0, 2, 6, 3, 1],
}

export function StatsModal({ open, onClose }: StatsModalProps) {
  if (!open) return null

  const maxDistribution = Math.max(...STATS.distribution)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-background border border-border shadow-xl overflow-hidden p-8 animate-in slide-in-from-bottom-4 duration-300 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl italic text-foreground">Statistics</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[
            { value: STATS.played, label: "Played" },
            { value: `${STATS.winPercent}%`, label: "Win %" },
            { value: STATS.currentStreak, label: "Current Streak" },
            { value: STATS.maxStreak, label: "Max Streak" },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-4 border border-border">
              <span className="block font-[family-name:var(--font-playfair)] text-3xl text-foreground">
                {stat.value}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Distribution */}
        <h3 className="font-[family-name:var(--font-playfair)] text-base italic text-foreground mb-4">
          Guess Distribution
        </h3>

        <div className="space-y-2">
          {STATS.distribution.map((count, index) => {
            const width = maxDistribution > 0 ? (count / maxDistribution) * 100 : 0
            const isHighest = count === maxDistribution && count > 0

            return (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right text-muted-foreground">{index + 1}</span>
                <div className="flex-1 bg-muted h-5">
                  <div
                    className={`h-full flex items-center justify-end px-2 text-xs text-primary-foreground transition-all duration-500 ${isHighest ? "bg-primary" : "bg-foreground"
                      }`}
                    style={{ width: `${Math.max(width, count > 0 ? 10 : 0)}%` }}
                  >
                    {count > 0 && count}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Handwritten note */}
        <p className="font-[family-name:var(--font-hand)] text-lg text-primary/60 text-center mt-8 rotate-[-1deg]">
          Keep sniffing! 🌸
        </p>
      </div>
    </div>
  )
}
