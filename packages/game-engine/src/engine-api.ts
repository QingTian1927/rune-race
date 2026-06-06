import type { GameState } from '@rune-race/shared'

export type EngineApi = {
  BOARD_TRACK_LENGTH: number
  BOARD_HOME_LANE_LENGTH: number
  absoluteTrackIndexFor: (playerIndex: number, progress: number) => number
  trackProgressForAbsoluteIndex: (playerIndex: number, absoluteIndex: number) => number | null
  boardSlotForPlayer: (state: GameState, playerId: string) => number
  safeTrackIndices: (state: GameState) => Set<number>
  appendFinishEvents: (
    state: GameState,
    tokens: GameState['tokens'],
    timestamp: number,
    preferredPlayerId?: string,
  ) => { events: GameState['events']; finishOrder: string[] }
  getNextPlayerIndex: (state: GameState, keepCurrentPlayer: boolean) => number
  shouldEndGameByFinishCount: (playerCount: number, finishedCount: number) => boolean
  syncCurrentPlayerIndex: (state: GameState) => GameState
}

let api: EngineApi | null = null

export function setEngineApi(next: EngineApi) {
  api = next
}

export function getEngineApi(): EngineApi {
  if (!api) {
    throw new Error('Engine API not initialized')
  }
  return api
}
