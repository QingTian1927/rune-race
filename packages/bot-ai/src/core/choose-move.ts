import type { BotProfile, GameState, LegalMove } from '@rune-race/shared'
import {
  boardSlotForPlayer,
  pickAutoSpawnMove,
  safeTrackIndices,
  shouldAutoExitStable,
  trackProgressForAbsoluteIndex,
  absoluteTrackIndexFor,
  BOARD_TRACK_LENGTH,
} from '@rune-race/game-engine'
import type { Rng } from '../types.js'

function isMoveTokenFrozen(state: GameState, move: LegalMove): boolean {
  const token = state.tokens.find((t) => t.id === move.tokenId)
  return Boolean(token && (token.freezeTurnsRemaining ?? 0) > 0)
}

function selectableMoves(state: GameState, legalMoves: LegalMove[]): LegalMove[] {
  const unfrozen = legalMoves.filter((move) => !isMoveTokenFrozen(state, move))
  return unfrozen.length > 0 ? unfrozen : legalMoves
}

/** Absolute track cell the move lands on, or null when it ends in home lane / unknown. */
function destinationTrackCellId(state: GameState, playerId: string, move: LegalMove): number | null {
  if (move.destination < 0 || move.destination >= BOARD_TRACK_LENGTH) return null
  const token = state.tokens.find((t) => t.id === move.tokenId)
  if (token && token.state === 'in_home_lane') return null
  const slot = boardSlotForPlayer(state, playerId)
  if (slot < 0) return null
  return absoluteTrackIndexFor(slot, move.destination)
}

/** True when an enemy on the main track could reach this cell with a single 1–6 roll. */
function isCellThreatened(state: GameState, playerId: string, absCellId: number): boolean {
  for (const enemy of state.tokens) {
    if (enemy.playerId === playerId || enemy.state !== 'on_track') continue
    const slot = boardSlotForPlayer(state, enemy.playerId)
    if (slot < 0) continue
    const progressForCell = trackProgressForAbsoluteIndex(slot, absCellId)
    if (progressForCell === null) continue
    const distance = progressForCell - enemy.position
    if (distance >= 1 && distance <= 6) return true
  }
  return false
}

function playerHasTokenOnBoard(state: GameState, playerId: string): boolean {
  return state.tokens.some(
    (t) => t.playerId === playerId && (t.state === 'on_track' || t.state === 'in_home_lane'),
  )
}

function scoreMove(state: GameState, playerId: string, move: LegalMove): number {
  let score = 0

  if (move.moveType === 'capture') {
    score += 120
    const victim = state.tokens.find((t) => t.id === move.capturedTokenId)
    if (victim) score += victim.position
  } else if (move.moveType === 'spawn') {
    score += playerHasTokenOnBoard(state, playerId) ? 45 : 85
  } else {
    score += 10 + move.destination * 2
  }

  const token = state.tokens.find((t) => t.id === move.tokenId)
  if (token?.state === 'in_home_lane') {
    // Finishing steps are always safe and close to victory.
    score += 90 + move.destination * 3
  }

  const absCell = destinationTrackCellId(state, playerId, move)
  if (absCell !== null) {
    const safeCells = safeTrackIndices(state)
    if (safeCells.has(absCell)) {
      score += 12
    } else if (isCellThreatened(state, playerId, absCell)) {
      score -= 30
    }
  }

  return score
}

export function chooseBotMove(
  state: GameState,
  playerId: string,
  profile: BotProfile,
  rng: Rng = Math.random,
): LegalMove | null {
  const legalMoves = state.turn.legalMoves
  if (legalMoves.length === 0) return null
  const moves = selectableMoves(state, legalMoves)

  if (profile === 'simple') {
    const capture = moves.find((m) => m.moveType === 'capture')
    if (capture) return capture
    const dice = state.turn.diceResult ?? 0
    if (shouldAutoExitStable(state, dice, moves)) {
      const spawn = pickAutoSpawnMove(state, moves)
      if (spawn) return spawn
    }
    return moves[Math.floor(rng() * moves.length)] ?? moves[0]!
  }

  let best = moves[0]!
  let bestScore = -Infinity
  for (const move of moves) {
    const score = scoreMove(state, playerId, move) + rng() * 5
    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }
  return best
}
