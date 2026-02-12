/**
 * Context barrel exports for clean imports
 *
 * Usage:
 * import { useGameState, useGameActions, useUIPreferences } from "@/components/game/contexts";
 */

export {
  GameStateProvider,
  useGameState,
  type Attempt,
  type AttemptFeedback,
} from "./game-state-context";

export { GameActionsProvider, useGameActions } from "./game-actions-context";

export {
  UIPreferencesProvider,
  useUIPreferences,
} from "./ui-preferences-context";
