import type { GameEvent, GameState } from '@rune-race/shared'
import { RUNE_FREEZE_TURNS } from '@rune-race/shared'
import { drawRuneCardType } from './deck.js'
import { canDrawMore, createEmptyRunePlayerState, drainPendingRewards, getRunePlayer } from './state.js'
import { openPlacementPhase } from './placement.js'

function now() {
  return Date.now()
}

export function ensureRunePlayer(state: GameState, playerId: string): GameState {
  if (!state.rune) return state
  if (state.rune.players[playerId]) return state
  return {
    ...state,
    rune: {
      ...state.rune,
      players: { ...state.rune.players, [playerId]: createEmptyRunePlayerState() },
    },
  }
}

/** Start-of normal turn housekeeping for the active player. */
export function runTurnStartHousekeeping(state: GameState, timestamp: number): GameState {
  if (!state.rune || state.turn.isBonusTurn) return state

  const playerId = state.turn.currentPlayerId
  let next = ensureRunePlayer(state, playerId)
  next = expireHeldCardsForPlayer(next, playerId, timestamp)
  next = tickMarkerTTL(next, playerId, timestamp)
  next = tickFreezeForPlayer(next, playerId, timestamp)
  next = drainPendingRewards(next, playerId, timestamp)
  return next
}

function expireHeldCardsForPlayer(state: GameState, playerId: string, timestamp: number): GameState {
  if (!state.rune) return state
  const player = state.rune.players[playerId]
  if (!player) return state

  const events = [...state.events]
  const kept = player.hand.filter((card) => {
    if (card.remainingHandRounds > 0) return true
    events.push({
      type: 'held_card_expired',
      timestamp,
      playerId,
      details: { heldCardId: card.heldCardId, cardType: card.cardType },
    })
    return false
  })

  const decremented = kept.map((card) => ({
    ...card,
    remainingHandRounds: card.remainingHandRounds - 1,
  }))

  return {
    ...state,
    events,
    rune: {
      ...state.rune,
      players: {
        ...state.rune.players,
        [playerId]: { ...player, hand: decremented },
      },
    },
  }
}

function tickMarkerTTL(state: GameState, activePlayerId: string, timestamp: number): GameState {
  if (!state.rune) return state

  const events = [...state.events]
  const remaining: typeof state.rune.markers = []

  state.rune.markers.forEach((marker) => {
    let shouldTick =
      marker.ttlMode === 'DISPLAYED_IDENTITY_TURN' &&
      marker.displayedIdentityId === activePlayerId

    if (!shouldTick && marker.ttlMode === 'FULL_TABLE_ROUND') {
      shouldTick = true
    }

    if (!shouldTick) {
      remaining.push(marker)
      return
    }

    const nextRounds = marker.remainingMarkerRounds - 1
    if (nextRounds <= 0) {
      events.push({
        type: 'marker_expired',
        timestamp,
        playerId: activePlayerId,
        details: { markerId: marker.markerId, cellId: marker.cellId },
      })
      return
    }
    remaining.push({ ...marker, remainingMarkerRounds: nextRounds })
  })

  return { ...state, events, rune: { ...state.rune, markers: remaining } }
}

export function tickFreezeForPlayer(state: GameState, playerId: string, timestamp: number): GameState {
  const expiredEvents: GameEvent[] = []
  const tokens = state.tokens.map((token) => {
    if (token.playerId !== playerId) return token
    const turns = token.freezeTurnsRemaining ?? 0
    if (turns <= 0) return token
    const next = turns - 1
    if (next <= 0) {
      expiredEvents.push({
        type: 'horse_status_changed',
        timestamp,
        playerId: token.playerId,
        details: {
          tokenId: token.id,
          status: 'freeze_expired',
          at: { state: token.state, position: token.position },
        },
      })
      return { ...token, freezeTurnsRemaining: 0 }
    }
    return { ...token, freezeTurnsRemaining: next }
  })
  if (expiredEvents.length === 0) {
    return { ...state, tokens, updatedAt: timestamp }
  }
  return { ...state, tokens, events: [...state.events, ...expiredEvents], updatedAt: timestamp }
}

/** Draw + simultaneous placement window (spec §3.1 steps 2–3). */
export function isRuneDrawAndPlacePhase(phase: GameState['turn']['phase']): boolean {
  return phase === 'placement_phase' || phase === 'waiting_draw'
}

export function beginNormalTurn(state: GameState): GameState {
  const timestamp = now()
  let next = runTurnStartHousekeeping(state, timestamp)
  next = {
    ...next,
    version: next.version + 1,
    turn: {
      ...next.turn,
      diceResult: null,
      legalMoves: [],
      pendingSwap: null,
      isBonusTurn: false,
    },
    updatedAt: timestamp,
  }
  if (next.config.runesEnabled && next.rune) {
    return openPlacementPhase({ ...next, version: next.version + 1 }, timestamp)
  }
  return {
    ...next,
    turn: { ...next.turn, phase: 'waiting_draw' },
    phase: 'waiting_draw',
  }
}

/** Set phase after turn advances (draw phase for rune games, roll otherwise). */
export function applyPostTurnAdvancePhase(
  state: GameState,
  options: { keepCurrentPlayer: boolean },
): GameState {
  if (!state.config.runesEnabled || !state.rune) {
    return {
      ...state,
      turn: {
        ...state.turn,
        phase: 'waiting_roll',
        diceResult: null,
        legalMoves: [],
        pendingSwap: null,
        isBonusTurn: false,
      },
      phase: 'waiting_roll',
    }
  }

  if (options.keepCurrentPlayer) {
    return beginBonusTurn(state)
  }
  return beginNormalTurn(state)
}

export function beginBonusTurn(state: GameState): GameState {
  const timestamp = now()
  return {
    ...state,
    version: state.version + 1,
    turn: {
      ...state.turn,
      phase: 'waiting_roll',
      isBonusTurn: true,
      diceResult: null,
      legalMoves: [],
      pendingSwap: null,
    },
    phase: 'waiting_roll',
    updatedAt: timestamp,
  }
}

export function drawCards(
  state: GameState,
  playerId: string,
  count: number,
  timestamp = now(),
): GameState {
  if (!state.rune || !isRuneDrawAndPlacePhase(state.turn.phase)) return state
  if (state.turn.currentPlayerId !== playerId) return state
  if (count < 1) return state

  const player = getRunePlayer(state, playerId)
  if (!player || !canDrawMore(player, count)) return state

  const events = [...state.events]
  const drawn: string[] = []
  let hand = [...player.hand]
  let drawCount = player.drawCount

  for (let i = 0; i < count; i += 1) {
    if (drawCount >= 25 || hand.length >= 10) break
    const cardType = drawRuneCardType()
    const heldCardId = `held-${state.roomId}-${playerId}-${timestamp}-${i}`
    hand.push({
      heldCardId,
      ownerPlayerId: playerId,
      cardType,
      remainingHandRounds: 2,
      source: 'DRAW',
    })
    drawn.push(cardType)
    drawCount += 1
  }

  if (drawn.length === 0) return state

  events.push({
    type: 'cards_drawn',
    timestamp,
    playerId,
    details: { count: drawn.length, cardTypes: drawn },
  })

  return {
    ...state,
    version: state.version + 1,
    rune: {
      ...state.rune,
      players: {
        ...state.rune.players,
        [playerId]: { ...player, hand, drawCount },
      },
    },
    events,
    updatedAt: timestamp,
  }
}

export function finishDrawPhase(state: GameState): GameState {
  if (!state.rune || state.turn.phase !== 'waiting_draw') return state
  const timestamp = now()
  let next = openPlacementPhase(state, timestamp)
  next = { ...next, version: next.version + 1, updatedAt: timestamp }
  return next
}

export function applyFreezeToToken(
  state: GameState,
  tokenId: string,
  timestamp: number,
  at?: { state: string; position: number },
): GameState {
  const sourceToken = state.tokens.find((t) => t.id === tokenId)
  const tokens = state.tokens.map((t) =>
    t.id === tokenId ? { ...t, freezeTurnsRemaining: RUNE_FREEZE_TURNS } : t,
  )
  const token = tokens.find((t) => t.id === tokenId)
  const freezeAt =
    at ??
    (sourceToken ? { state: sourceToken.state, position: sourceToken.position } : undefined)
  const events: GameEvent[] = [
    ...state.events,
    {
      type: 'horse_status_changed',
      timestamp,
      playerId: token?.playerId ?? '',
      details: {
        tokenId,
        status: 'freeze',
        turns: RUNE_FREEZE_TURNS,
        at: freezeAt,
      },
    },
  ]
  return { ...state, tokens, events }
}

export function isTokenFrozen(token: GameState['tokens'][number]): boolean {
  return (token.freezeTurnsRemaining ?? 0) > 0
}
