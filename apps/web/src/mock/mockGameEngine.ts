/**
 * Re-exports authoritative game rules from @rune-race/game-engine.
 * Local dev uses the same logic as the server.
 */
export {
  MOCK_PLAYER_COUNT,
  BOARD_TRACK_LENGTH,
  BOARD_HOME_LANE_LENGTH,
  BOARD_DIRECTION_MULTIPLIER,
  createMockGameState,
  createInitialGameState,
  rollMockTurn,
  rollTurn,
  resolveMockTurn,
  resolveTurn,
  sortPlayersByColor,
} from '@rune-race/game-engine'

export type { MockPathStep, MockMoveEventDetails } from '@rune-race/game-engine'
