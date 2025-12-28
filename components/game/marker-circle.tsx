"use client"

interface MarkerCircleProps {
  letter: string
  title?: string
}

export function MarkerCircle({ letter, title }: MarkerCircleProps) {
  return (
    <span title={title} className="relative inline-flex items-center justify-center w-6 h-6">
      {/* SVG hand-drawn circle */}
      <svg className="absolute inset-0 w-full h-full marker-circle" viewBox="0 0 24 24" fill="none">
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="9"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="100"
          strokeDashoffset="0"
          transform="rotate(-5 12 12)"
          style={{
            filter: "url(#roughen)",
          }}
        />
        <defs>
          <filter id="roughen">
            <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
          </filter>
        </defs>
      </svg>

      {/* Letter */}
      <span className="relative z-10 text-sm font-medium text-primary">{letter}</span>
    </span>
  )
}
