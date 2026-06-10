import { describe, expect, it } from 'vitest'
import { handleRoll } from './commands.js'
import {
  createInitialGameState,
  getNextPlayerIndex,
  isExitBaseLegalMove,
  playerAllTokensInBase,
  rollTurn,
  shouldAutoExitStable,
} from './engine.js'
import { resolveMoveWithRunes } from './rune/movement.js'
import { closePlacementPhase } from './rune/placement.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

describe('spawn after kick back to stable', () => {
  function kickRedHome(state: ReturnType<typeof createInitialGameState>) {
    const redToken = state.tokens.find((t) => t.playerId === 'p-red' && t.state === 'on_track')!
    return {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === redToken.id
          ? {
              ...t,
              state: 'in_base' as const,
              position: Number(redToken.id.split(':')[1]),
              hasShield: false,
              freezeTurnsRemaining: 0,
            }
          : t,
      ),
      turn: { ...state.turn, currentPlayerId: 'p-red', phase: 'waiting_roll' as const },
      phase: 'waiting_roll' as const,
    }
  }

  function toWaitingRoll(state: ReturnType<typeof createInitialGameState>) {
    return {
      ...state,
      turn: { ...state.turn, phase: 'waiting_roll' as const, diceResult: null, legalMoves: [] },
      phase: 'waiting_roll' as const,
    }
  }

  function spawnRed(state: ReturnType<typeof createInitialGameState>) {
    const rolled = handleRoll(toWaitingRoll(state), 'p-red', () => 6)
    expect(rolled.success).toBe(true)
    return rolled.success ? rolled.state : state
  }

  it('rune mode: auto-spawns when all tokens in base after traditional kick', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    state = spawnRed(state)
    expect(state.tokens.filter((t) => t.playerId === 'p-red' && t.state === 'on_track')).toHaveLength(1)

    state = kickRedHome(state)
    expect(state.tokens.every((t) => t.playerId !== 'p-red' || t.state === 'in_base')).toBe(true)

    const rolled = handleRoll(state, 'p-red', () => 6)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return

    expect(rolled.state.tokens.filter((t) => t.playerId === 'p-red' && t.state === 'on_track')).toHaveLength(1)
    expect(rolled.state.turn.phase).toBe('waiting_roll')
  })

  it('classic mode: auto-spawns when all tokens in base after kick', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: false,
    })

    state = spawnRed(state)
    state = kickRedHome(state)

    const rolled = handleRoll(state, 'p-red', () => 1)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return

    expect(rolled.state.tokens.filter((t) => t.playerId === 'p-red' && t.state === 'on_track')).toHaveLength(1)
  })

  it('rune mode: full capture flow then red can auto-spawn on next turn', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    const redToken = state.tokens.find((t) => t.playerId === 'p-red')!
    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!

    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: 33 }
        return t
      }),
      turn: { ...state.turn, currentPlayerId: 'p-red', phase: 'waiting_roll' as const },
      phase: 'waiting_roll' as const,
    }

    const redSpawn = handleRoll(state, 'p-red', () => 6)
    expect(redSpawn.success).toBe(true)
    if (!redSpawn.success) return
    state = redSpawn.state

    const redOnTrack = state.tokens.find((t) => t.id === redToken.id)!
    const blueTurnState = {
      ...state,
      currentPlayerIndex: 1,
      tokens: state.tokens.map((t) => {
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: 32 }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice' as const,
        diceResult: 1,
        isBonusTurn: false,
        legalMoves: [
          {
            id: 'capture-red',
            tokenId: blueToken.id,
            moveType: 'capture' as const,
            destination: 33,
            capturedTokenId: redOnTrack.id,
          },
        ],
      },
      phase: 'waiting_choice' as const,
    }

    state = resolveMoveWithRunes(blueTurnState, blueTurnState.turn.legalMoves[0]!)
    expect(state.tokens.find((t) => t.id === redToken.id)!.state).toBe('in_base')
    expect(state.tokens.every((t) => t.playerId !== 'p-red' || t.state === 'in_base')).toBe(true)
    expect(state.turn.currentPlayerId).toBe('p-red')
    expect(state.turn.phase).toBe('placement_phase')

    state = closePlacementPhase(state, Date.now())
    expect(state.turn.phase).toBe('waiting_roll')

    const redRoll = handleRoll(state, 'p-red', () => 6)
    expect(redRoll.success).toBe(true)
    if (!redRoll.success) return

    expect(redRoll.state.tokens.filter((t) => t.playerId === 'p-red' && t.state === 'on_track')).toHaveLength(1)
    expect(redRoll.state.turn.phase).not.toBe('waiting_choice')
  })

  it('blocks spawn when own token still occupies start cell (single track move only)', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    const [red0, red1] = state.tokens.filter((t) => t.playerId === 'p-red')
    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === red0!.id) return { ...t, state: 'on_track' as const, position: 0 }
        if (t.id === red1!.id) return { ...t, state: 'in_base' as const, position: 1 }
        return t
      }),
      turn: { ...state.turn, currentPlayerId: 'p-red', phase: 'waiting_roll' as const },
      phase: 'waiting_roll' as const,
    }

    const preview = rollTurn(state, () => 6)
    expect(preview.turn.legalMoves).toHaveLength(1)
    expect(preview.turn.legalMoves[0]!.moveType).toBe('move')
    expect(preview.turn.legalMoves.some((m) => isExitBaseLegalMove(m, state.tokens))).toBe(false)
  })

  it('shows waiting_choice when one token on track and one in base with clear start', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    const [red0, red1] = state.tokens.filter((t) => t.playerId === 'p-red')
    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === red0!.id) return { ...t, state: 'on_track' as const, position: 5 }
        if (t.id === red1!.id) return { ...t, state: 'in_base' as const, position: 1 }
        return t
      }),
      turn: { ...state.turn, currentPlayerId: 'p-red', phase: 'waiting_roll' as const },
      phase: 'waiting_roll' as const,
    }

    const preview = rollTurn(state, () => 6)
    expect(preview.turn.phase).toBe('waiting_choice')
    expect(preview.turn.legalMoves.length).toBeGreaterThan(1)
  })

  it('getNextPlayerIndex follows turn.currentPlayerId when index is stale', () => {
    const state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    const desynced = {
      ...state,
      currentPlayerIndex: 0,
      turn: { ...state.turn, currentPlayerId: 'p-blue' },
    }

    expect(getNextPlayerIndex(desynced, false)).toBe(0)
  })

  it('shouldAutoExitStable is false when spawn and track moves are both legal', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    const [red0, red1] = state.tokens.filter((t) => t.playerId === 'p-red')
    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === red0!.id) return { ...t, state: 'on_track' as const, position: 3 }
        return t
      }),
      turn: { ...state.turn, currentPlayerId: 'p-red', phase: 'waiting_roll' as const },
      phase: 'waiting_roll' as const,
    }

    const rolled = rollTurn(state, () => 6)
    expect(playerAllTokensInBase(state, 'p-red')).toBe(false)
    expect(shouldAutoExitStable(rolled, 6, rolled.turn.legalMoves)).toBe(false)
  })

  it('auto-spawns when only stable exit moves exist despite frozen token on track', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueTokens = state.tokens.filter((t) => t.playerId === 'p-blue')
    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === blueTokens[0]!.id) {
          return {
            ...t,
            state: 'on_track' as const,
            position: 8,
            freezeTurnsRemaining: 3,
          }
        }
        return t
      }),
      turn: { ...state.turn, currentPlayerId: 'p-blue', phase: 'waiting_roll' as const },
      phase: 'waiting_roll' as const,
    }

    expect(playerAllTokensInBase(state, 'p-blue')).toBe(false)

    const rolled = handleRoll(state, 'p-blue', () => 1)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return

    expect(rolled.state.turn.phase).not.toBe('waiting_choice')
    expect(rolled.state.tokens.filter((t) => t.playerId === 'p-blue' && t.state === 'on_track')).toHaveLength(2)
  })

  it('auto-spawns when frozen own token at start would otherwise block exit', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const blueTokens = state.tokens.filter((t) => t.playerId === 'p-blue')
    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === blueTokens[0]!.id) {
          return {
            ...t,
            state: 'on_track' as const,
            position: 0,
            freezeTurnsRemaining: 3,
          }
        }
        return t
      }),
      turn: { ...state.turn, currentPlayerId: 'p-blue', phase: 'waiting_roll' as const },
      phase: 'waiting_roll' as const,
    }

    const rolled = handleRoll(state, 'p-blue', () => 1)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return

    expect(rolled.state.turn.phase).not.toBe('waiting_choice')
    expect(rolled.state.tokens.filter((t) => t.playerId === 'p-blue' && t.state === 'on_track')).toHaveLength(1)
    expect(rolled.state.tokens.find((t) => t.id === blueTokens[0]!.id)!.state).toBe('in_base')
  })

  it('does not show waiting_choice when all tokens in base (rune, 2 tokens)', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    state = spawnRed(state)
    state = kickRedHome(state)

    const preview = rollTurn(state, () => 6)
    expect(preview.turn.phase).not.toBe('waiting_choice')
    expect(preview.turn.legalMoves.every((m) => m.moveType === 'spawn' || m.moveType === 'capture')).toBe(true)
  })
})
