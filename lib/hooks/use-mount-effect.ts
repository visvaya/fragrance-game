/* eslint-disable react-compiler/react-compiler -- intentional: this file wraps useEffect with disabled exhaustive-deps; optimizer cannot run */
import { useEffect } from "react";

/**
 * One-time side effect on mount. Use instead of useEffect(fn, []).
 * Prevents accidental dependency array omissions and makes intent explicit.
 */
export function useMountEffect(effect: () => void): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mount-only effect with no deps
  useEffect(effect, []);
}
