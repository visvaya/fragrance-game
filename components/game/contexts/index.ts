/**
 * Context barrel exports for clean imports
 *
 * Usage:
 * import { useGameState, useGameActions, useUIPreferences } from "@/components/game/contexts";
 */

export {
  type Attempt,
  type DailyPerfume,
  type GameState,
  GameStateProvider,
  useGameState,
} from "./game-state-context";

export { GameActionsProvider, useGameActions } from "./game-actions-context";

export { useUIPreferences } from "./ui-preferences-context";
