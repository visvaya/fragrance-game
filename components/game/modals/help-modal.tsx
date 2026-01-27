"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Waves } from "lucide-react"
import { MarkerCircle } from "../marker-circle"
import { useTranslations } from "next-intl"

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [mounted, setMounted] = useState(false)
  const t = useTranslations('HelpModal')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-background border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300 rounded-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-4 border-b border-border shrink-0">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl text-foreground">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary transition-colors"
            aria-label={t('ariaClose')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div
          className="space-y-4 text-sm leading-relaxed text-foreground p-6 pt-4 overflow-y-auto"
          data-lenis-prevent
        >
          <p>
            <strong>{t('intro')}</strong>
          </p>
          <p className="text-muted-foreground">
            {t('description')}
          </p>

          <ul className="space-y-3 pl-4">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>{t('cluesTitle')}</strong> {t('cluesDesc')}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>{t('feedbackTitle')}</strong> {t('feedbackDesc')}
              </span>
            </li>
          </ul>

          {/* Feedback legend */}
          <div className="bg-muted/50 p-4 space-y-2 mt-4">
            <div className="flex items-center gap-3">
              <MarkerCircle letter="✓" className="w-5 h-5" />
              <span className="text-muted-foreground">{t('feedbackCorrect')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-5 h-5">
                <Waves className="w-4 h-4 text-muted-foreground opacity-50 transform -skew-x-12" strokeWidth={1.5} />
              </span>
              <span className="text-muted-foreground">{t('feedbackClose')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-5 h-5 opacity-50">
                <X className="w-4 h-4 text-muted-foreground transform -skew-x-12" strokeWidth={1.5} />
              </span>
              <span className="text-muted-foreground">{t('feedbackWrong')}</span>
            </div>
          </div>

          <ul className="space-y-3 pl-4">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              <span>
                <strong>{t('scoreTitle')}</strong> {t('scoreDesc')}
              </span>
            </li>
          </ul>

          <p className="text-xs text-muted-foreground italic mt-6 pt-4 border-t border-border">
            {t('note')}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
