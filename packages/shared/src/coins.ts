import { isBotPlayerId } from './bot.js'
import type { GameEvent, GameState } from './types/game.js'

export const COIN_CAPTURE_ENEMY = 50
export const COIN_SELF_KICK_PENALTY = 30
export const COIN_FINISH_BASE = 200

/** Rank 1 = nhất; rank N = bét trong số người đã về đích. */
export const COIN_FINISH_POSITION_MULTIPLIER: Record<number, number> = {
  1: 4,
  2: 2,
  3: 1,
}

export const COIN_PLAYER_COUNT_MULTIPLIER: Record<number, number> = {
  2: 1,
  3: 1.5,
  4: 2,
}

export type CoinBreakdown = {
  capture: number
  finish: number
  total: number
}

/** Bots are excluded from capture/finish rewards and settlement. */
export function isCoinEligiblePlayer(playerId: string): boolean {
  return !isBotPlayerId(playerId)
}

export function playerIdFromTokenId(tokenId: string): string {
  const lastColon = tokenId.lastIndexOf(':')
  if (lastColon <= 0) return tokenId
  return tokenId.slice(0, lastColon)
}

export function computeFinishCoins(
  rank: number | null,
  playerCount: number,
  lastFinishedRank: number,
): number {
  if (rank === null) {
    return COIN_FINISH_BASE
  }
  if (rank === lastFinishedRank && lastFinishedRank > 1) {
    return COIN_FINISH_BASE
  }
  const positionMultiplier = COIN_FINISH_POSITION_MULTIPLIER[rank] ?? 1
  const playerMultiplier = COIN_PLAYER_COUNT_MULTIPLIER[playerCount] ?? 1
  return Math.round(COIN_FINISH_BASE * positionMultiplier * playerMultiplier)
}

export function captureCoinDeltaFromEvent(event: GameEvent): number | null {
  if (event.type !== 'token_captured') return null

  const capturedTokenId =
    typeof event.details?.capturedTokenId === 'string' ? event.details.capturedTokenId : ''
  if (!capturedTokenId) return null

  const capturedPlayerId =
    typeof event.details?.capturedPlayerId === 'string'
      ? event.details.capturedPlayerId
      : playerIdFromTokenId(capturedTokenId)

  const isFriendlyCapture =
    typeof event.details?.isFriendlyCapture === 'boolean'
      ? event.details.isFriendlyCapture
      : capturedPlayerId === event.playerId

  return isFriendlyCapture ? -COIN_SELF_KICK_PENALTY : COIN_CAPTURE_ENEMY
}

export function computeCoinSettlement(state: GameState): Record<string, CoinBreakdown> {
  const breakdownByPlayer: Record<string, CoinBreakdown> = {}
  for (const player of state.players) {
    if (!isCoinEligiblePlayer(player.id)) continue
    breakdownByPlayer[player.id] = { capture: 0, finish: 0, total: 0 }
  }

  for (const event of state.events) {
    const delta = captureCoinDeltaFromEvent(event)
    if (delta === null) continue
    const kickerId = event.playerId
    if (!isCoinEligiblePlayer(kickerId) || !breakdownByPlayer[kickerId]) continue
    breakdownByPlayer[kickerId].capture += delta
  }

  const finishRanks = new Map<string, number>()
  let lastFinishedRank = 0
  for (const event of state.events) {
    if (event.type !== 'token_finished') continue
    const playerId =
      typeof event.details?.playerId === 'string' ? event.details.playerId : event.playerId
    if (finishRanks.has(playerId)) continue
    const rank =
      typeof event.details?.rank === 'number' ? event.details.rank : finishRanks.size + 1
    finishRanks.set(playerId, rank)
    lastFinishedRank = Math.max(lastFinishedRank, rank)
  }

  const playerCount = state.players.length
  for (const player of state.players) {
    if (!isCoinEligiblePlayer(player.id)) continue
    const breakdown = breakdownByPlayer[player.id]
    if (!breakdown) continue
    breakdown.finish = computeFinishCoins(finishRanks.get(player.id) ?? null, playerCount, lastFinishedRank)
    breakdown.total = breakdown.capture + breakdown.finish
  }

  return breakdownByPlayer
}

export function formatCoinAmount(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} xu`
}
