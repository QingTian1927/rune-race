import { Group } from 'three'

const PAWN_CACHE: { [key: string]: Group } = {}

export async function loadPawnModel(player: number): Promise<Group> {
  const cacheKey = `pawn-${player}`

  if (PAWN_CACHE[cacheKey]) {
    return PAWN_CACHE[cacheKey].clone()
  }

  // For now, return a dummy pawn group - actual OBJ loading will be deferred to MVP+
  // since we need proper Three.js loader setup
  const pawn = new Group()
  pawn.scale.set(0.5, 0.5, 0.5)

  PAWN_CACHE[cacheKey] = pawn
  return pawn.clone()
}
