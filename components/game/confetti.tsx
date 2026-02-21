"use client";

import { memo } from "react";

// Brand-coherent amber/cream palette
const COLORS = [
  "oklch(0.72 0.16 55)", // amber
  "oklch(0.82 0.14 60)", // light amber
  "oklch(0.92 0.04 85)", // cream
  "oklch(0.65 0.18 45)", // deep amber
  "oklch(0.78 0.10 70)", // gold
  "oklch(0.96 0.02 85)", // off-white
];

const PARTICLE_COUNT = 55;

// Deterministic pseudo-random offsets — avoids hydration issues
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  color: COLORS[i % COLORS.length],
  delay: `${((i * 0.06) % 1.4).toFixed(2)}s`,
  duration: `${(1.2 + ((i * 0.05) % 0.9)).toFixed(2)}s`,
  id: i,
  isSquare: i % 3 === 0,
  left: `${((i * 7.3 + 3) % 100).toFixed(1)}%`,
  size: `${4 + (i % 5)}px`,
}));

/**
 * Confetti overlay shown on game win.
 * CSS-only particles — no external library.
 */
export const Confetti = memo(function Confetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {particles.map((p) => (
        <div
          className="animate-confetti-fall absolute -top-3"
          key={p.id}
          style={{
            animationDelay: p.delay,
            animationDuration: p.duration,
            left: p.left,
          }}
        >
          <div
            className={p.isSquare ? "rotate-45" : "rounded-full"}
            style={{
              backgroundColor: p.color,
              height: p.isSquare ? p.size : `${Math.max(2, Number.parseInt(p.size) - 2)}px`,
              width: p.size,
            }}
          />
        </div>
      ))}
    </div>
  );
});
