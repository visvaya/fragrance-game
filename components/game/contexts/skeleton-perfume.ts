import { GENERIC_PLACEHOLDER } from "@/lib/constants";

import type { DailyPerfume } from "./game-state-context";

/** Placeholder daily perfume shown while the real challenge loads (avoids null checks). */
export const SKELETON_PERFUME: DailyPerfume = {
  concentration: undefined,
  id: "skeleton",
  imageUrl: "/placeholder.svg?height=400&width=400",
  name: GENERIC_PLACEHOLDER.repeat(5),
  xsolve: 0,
};
