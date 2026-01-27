'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useGame } from './game-provider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";

// TODO: REMOVE BEFORE PRODUCTION
// This component allows resetting the game state for debugging purposes.
export function ResetButton() {
    const { resetGame } = useGame();
    const [showConfirm, setShowConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const t = useTranslations('ResetButton');

    const handleConfirmedReset = async () => {
        setIsResetting(true);
        try {
            await resetGame();
        } finally {
            setIsResetting(false);
            setShowConfirm(false);
        }
    };

    if (!showConfirm) {
        return (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setShowConfirm(true)}
                            className="text-foreground/70 hover:text-primary transition-colors duration-300 flex items-center justify-center p-1"
                            aria-label={t('ariaLabel')}
                        >
                            <RotateCcw size={18} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('tooltip')}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <div className="absolute top-full right-0 mt-2 bg-card border border-border 
                    text-card-foreground px-4 py-2 rounded shadow-lg z-50 w-max">
            <p className="text-sm mb-2 font-semibold">{t('question')}</p>
            <div className="flex gap-2 justify-end">
                <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isResetting}
                    className="text-xs px-2 py-1 hover:underline disabled:opacity-50"
                >
                    {t('cancel')}
                </button>
                <button
                    onClick={handleConfirmedReset}
                    disabled={isResetting}
                    className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs hover:bg-primary/90 disabled:opacity-50 font-semibold"
                >
                    {isResetting ? '...' : t('confirm')}
                </button>
            </div>
        </div>
    );
}
