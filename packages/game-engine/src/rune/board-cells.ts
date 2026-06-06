import type { BoardMarker, GameState } from '@rune-race/shared'
import { getEngineApi } from '../engine-api.js'

/** Absolute main-track cell id (0 … trackLength-1). */
export function cellIdForTokenOnTrack(state: GameState, token: GameState['tokens'][number]): number | null {
  if (token.state !== 'on_track') return null
  const { boardSlotForPlayer, absoluteTrackIndexFor } = getEngineApi()
  const slot = boardSlotForPlayer(state, token.playerId)
  if (slot < 0) return null
  return absoluteTrackIndexFor(slot, token.position)
}

export function isSharedTrackCellId(cellId: number): boolean {
  const { BOARD_TRACK_LENGTH } = getEngineApi()
  return cellId >= 0 && cellId < BOARD_TRACK_LENGTH
}

export function isCellOccupiedByToken(state: GameState, cellId: number): boolean {
  return state.tokens.some((token) => cellIdForTokenOnTrack(state, token) === cellId)
}

export function markerAtCell(markers: BoardMarker[], cellId: number): BoardMarker | undefined {
  return markers.find((m) => m.cellId === cellId)
}

export function listValidPlacementCellIds(state: GameState): number[] {
  if (!state.rune) return []
  const occupied = new Set<number>()
  state.tokens.forEach((token) => {
    const cell = cellIdForTokenOnTrack(state, token)
    if (cell !== null) occupied.add(cell)
  })
  const markerCells = new Set(state.rune.markers.map((m) => m.cellId))

  const valid: number[] = []
  const { BOARD_TRACK_LENGTH } = getEngineApi()
  for (let cellId = 0; cellId < BOARD_TRACK_LENGTH; cellId += 1) {
    if (occupied.has(cellId)) continue
    if (markerCells.has(cellId)) continue
    valid.push(cellId)
  }
  return valid
}
