import { absoluteTrackIndexFor } from '@rune-race/game-engine'
import type { MockPathStep } from '../mock/mockGameEngine'
import { MAIN_TRACK_CELL_IDS, pickNearestPlacementCell } from './placementCellPick'

export function cellIdForTrackStepBySlot(
  playerSlot: number,
  step: MockPathStep,
): number | null {
  if (step.state !== 'on_track') return null
  if (playerSlot < 0) return null
  return absoluteTrackIndexFor(playerSlot, step.position)
}

export function resolveLandedCellIds(
  playerSlot: number,
  step: MockPathStep,
  worldX?: number,
  worldZ?: number,
): number[] {
  const cellIds = new Set<number>()
  const fromStep = cellIdForTrackStepBySlot(playerSlot, step)
  if (fromStep !== null) cellIds.add(fromStep)

  if (worldX !== undefined && worldZ !== undefined) {
    const fromWorld = pickNearestPlacementCell(worldX, worldZ, MAIN_TRACK_CELL_IDS, 0.11)
    if (fromWorld !== null) cellIds.add(fromWorld)
  }

  return [...cellIds]
}

/** @deprecated Prefer cellIdForTrackStepBySlot — player slot must match board layout index. */
export function cellIdsOnTrackPathBySlot(playerSlot: number, path: MockPathStep[]): number[] {
  const ids: number[] = []
  path.forEach((step) => {
    const cellId = cellIdForTrackStepBySlot(playerSlot, step)
    if (cellId !== null) ids.push(cellId)
  })
  return ids
}
