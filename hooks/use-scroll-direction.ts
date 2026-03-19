"use client";

// eslint-disable-next-line no-restricted-imports -- scroll listener: attaches passive scroll event listener; deps include threshold
import { useState, useEffect } from "react";

/**
 * Returns true when the user is scrolling down (past the threshold),
 * false when scrolling up or near the top.
 * Used to hide the header on mobile during downward scroll.
 */
export function useScrollDirection(threshold = 60) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Always show near the top of the page
      if (currentScrollY < threshold) {
        setHidden(false);
        // eslint-disable-next-line fp/no-mutation -- necessary for scroll tracking
        lastScrollY = currentScrollY;
        return;
      }

      const delta = currentScrollY - lastScrollY;

      if (delta > 5) {
        setHidden(true);
      } else if (delta < -5) {
        setHidden(false);
      }

      // eslint-disable-next-line fp/no-mutation -- necessary for scroll tracking
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return hidden;
}
