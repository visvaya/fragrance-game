'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useGame } from './game-provider';

// TODO: REMOVE BEFORE PRODUCTION
// This component allows resetting the game state for debugging purposes.
export function ResetButton() {
    const { resetGame } = useGame();
    // ... existing logic ...
    const [showConfirm, setShowConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

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
            <button
                onClick={() => setShowConfirm(true)}
                className="fixed top-4 right-4 text-muted-foreground/50 hover:text-foreground hover:bg-muted/10 
                   px-3 py-1.5 rounded-md text-sm transition-all duration-200 
                   flex items-center gap-2 z-50 border border-transparent hover:border-border/20"
                title="Debug: Reset game session"
            >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Debug Reset</span>
            </button>
        );
    }

    return (
        <div className="fixed top-4 right-4 bg-charcoal border border-amber-500 
                    text-cream px-4 py-2 rounded shadow-lg z-50">
            <p className="text-sm mb-2">Reset game session?</p>
            <div className="flex gap-2">
                <button
                    onClick={handleConfirmedReset}
                    disabled={isResetting}
                    className="bg-amber-500 px-3 py-1 rounded text-sm hover:bg-amber-600 disabled:opacity-50 text-charcoal font-semibold"
                >
                    {isResetting ? 'Resetting...' : 'Confirm'}
                </button>
                <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isResetting}
                    className="bg-cream/10 px-3 py-1 rounded text-sm hover:bg-cream/20 disabled:opacity-50 text-cream"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
