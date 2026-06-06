import boardLayout from '../../data/board-layout.json'

type TrackCell = { index?: number; x: number; y: number; z: number }

const MAIN_TRACK = boardLayout.mainTrack as TrackCell[]

const CELLS_BY_ID = new Map<number, TrackCell>()
MAIN_TRACK.forEach((cell, arrayIndex) => {
  const id = typeof cell.index === 'number' ? cell.index : arrayIndex
  CELLS_BY_ID.set(id, cell)
})

export const MAIN_TRACK_CELL_IDS = [...CELLS_BY_ID.keys()]

/** Max XZ distance from click to cell center (adjacent cells are ~0.18–0.22 apart). */
export const PLACEMENT_PICK_RADIUS = 0.09

export function getMainTrackCell(cellId: number): TrackCell | undefined {
  return CELLS_BY_ID.get(cellId)
}

/**
 * Nearest valid placement cell to a world hit on the board (XZ only).
 */
export function pickNearestPlacementCell(
  worldX: number,
  worldZ: number,
  validCellIds: readonly number[],
  maxRadius = PLACEMENT_PICK_RADIUS,
): number | null {
  let bestId: number | null = null
  let bestDistSq = maxRadius * maxRadius

  for (const cellId of validCellIds) {
    const cell = CELLS_BY_ID.get(cellId)
    if (!cell) continue

    const dx = worldX - cell.x
    const dz = worldZ - cell.z
    const distSq = dx * dx + dz * dz
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      bestId = cellId
    }
  }

  return bestId
}
