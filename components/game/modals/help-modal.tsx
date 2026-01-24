"use client"

import { X, Waves } from "lucide-react"
import { MarkerCircle } from "../marker-circle"

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass-panel p-8 animate-in slide-in-from-bottom-4 duration-300 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl italic text-foreground">How to Play</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-sm leading-relaxed text-foreground">
          <p>
            <strong>Deduce the mystery fragrance.</strong>
          </p>
          <p className="text-muted-foreground">
            Every day, a new perfume is selected. You have 5 attempts to guess it based on evolving clues.
          </p>

          <ul className="space-y-3 pl-4">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>Clues:</strong> The image clears up, and more letters are revealed with each guess.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>Feedback:</strong> Watch for editorial marks in your log:
              </span>
            </li>
          </ul>

          {/* Feedback legend */}
          <div className="bg-muted/50 p-4 space-y-2 mt-4">
            <div className="flex items-center gap-3">
              <MarkerCircle letter="✓" className="w-5 h-5" />
              <span className="text-muted-foreground">Circled = Correct match</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-5 h-5">
                <Waves className="w-4 h-4 text-muted-foreground opacity-50 transform -skew-x-12" strokeWidth={1.5} />
              </span>
              <span className="text-muted-foreground">Waves = Close / Partial</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-5 h-5 opacity-50">
                <X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} />
              </span>
              <span className="text-muted-foreground">Cross = Incorrect</span>
            </div>
          </div>

          <ul className="space-y-3 pl-4">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>Score:</strong> Faster guesses with fewer attempts yield higher scores.
              </span>
            </li>
          </ul>

          <p className="text-xs text-muted-foreground italic mt-6 pt-4 border-t border-border">
            Note: Switching tabs may incur a time penalty during the daily challenge.
          </p>
        </div>
      </div>
    </div>
  )
}
