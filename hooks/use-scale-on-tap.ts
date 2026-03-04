import { useState } from "react";

/**
 * Returns state and pointer handler for a scale-on-tap effect on mobile.
 * The scaled state stays true for `duration` ms after the finger lifts,
 * so the CSS transition has time to animate back visibly.
 * Desktop hover is handled separately via CSS `hover:scale-*` classes.
 */
export function useScaleOnTap(duration = 400) {
  const [scaled, setScaled] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      setScaled(true);
      setTimeout(() => setScaled(false), duration);
    }
  };

  return { handlePointerDown, scaled };
}
