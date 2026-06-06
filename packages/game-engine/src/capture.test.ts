import { describe, expect, it } from 'vitest'
import { createInitialGameState, absoluteTrackIndexFor, boardSlotForPlayer, rollTurn, resolveTurn } from './engine.js'
import { handleRoll } from './commands.js'
import { resolveMoveWithRunes } from './rune/movement.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function sharedCellPositions(
  state: ReturnType<typeof createInitialGameState>,
  options?: { excludeSafe?: boolean },
) {
  const safe = new Set([0, 11, 22, 33])
  for (let redPos = 0; redPos < 44; redPos += 1) {
    const abs = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-red'), redPos)
    if (options?.excludeSafe && safe.has(abs)) continue
    for (let bluePos = 0; bluePos < 44; bluePos += 1) {
      if (absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), bluePos) === abs) {
        return { abs, redPos, bluePos }
      }
    }
  }
  return null
}

describe('traditional capture symmetry', () => {
  it('rune mode: spawn onto shared start cell captures opponent', () => {
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
      turn: {
        ...state.turn,
        currentPlayerId: 'p-red',
        phase: 'waiting_choice',
        diceResult: 1,
        legalMoves: [
          {
            id: 'spawn-capture',
            tokenId: redToken.id,
            moveType: 'capture',
            destination: 0,
            capturedTokenId: blueToken.id,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const afterRedSpawn = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    expect(afterRedSpawn.tokens.find((t) => t.id === redToken.id)!.state).toBe('on_track')
    expect(afterRedSpawn.tokens.find((t) => t.id === blueToken.id)!.state).toBe('in_base')

    // Red at abs 0 (pos 0); blue moves from 32 → 33 to land on the same cell.
    const redOnTrack = afterRedSpawn.tokens.find((t) => t.id === redToken.id)!
    const blueTurnState = {
      ...afterRedSpawn,
      tokens: afterRedSpawn.tokens.map((t) => {
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: 32 }
        return t
      }),
      turn: {
        ...afterRedSpawn.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_choice' as const,
        diceResult: 1,
        legalMoves: [
          {
            id: 'move',
            tokenId: blueToken.id,
            moveType: 'capture',
            destination: 33,
            capturedTokenId: redOnTrack.id,
          },
        ],
      },
      phase: 'waiting_choice' as const,
    }

    const afterBlueMove = resolveMoveWithRunes(blueTurnState, blueTurnState.turn.legalMoves[0]!)
    expect(afterBlueMove.tokens.find((t) => t.id === redOnTrack.id)!.state).toBe('in_base')
  })

  it('non-rune spawn onto occupied start cell captures opponent', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: false,
    })

    const redToken = state.tokens.find((t) => t.playerId === 'p-red')!
    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: 33 }
        return t
      }),
      turn: { ...state.turn, currentPlayerId: 'p-red', phase: 'waiting_roll' },
      phase: 'waiting_roll',
    }

    const rolled = rollTurn(state, () => 1)
    const captureMove = rolled.turn.legalMoves.find((m) => m.moveType === 'capture' && m.tokenId === redToken.id)
    expect(captureMove).toBeTruthy()
    const resolved = resolveTurn(rolled, captureMove!.id)
    expect(resolved.tokens.find((t) => t.id === blueToken.id)!.state).toBe('in_base')
  })

  it('rune mode: rolling 6 auto-resolves capture spawn onto occupied start cell', () => {
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
      turn: { ...state.turn, currentPlayerId: 'p-red', phase: 'waiting_roll' },
      phase: 'waiting_roll',
    }

    const rolled = handleRoll(state, 'p-red', () => 6)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return

    expect(rolled.state.tokens.find((t) => t.id === redToken.id)!.state).toBe('on_track')
    expect(rolled.state.tokens.find((t) => t.id === blueToken.id)!.state).toBe('in_base')
  })

  it('red landing on blue cell captures blue (non-safe)', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: false,
    })

    const cell = sharedCellPositions(state, { excludeSafe: true })
    expect(cell).not.toBeNull()
    const { redPos, bluePos } = cell!

    const redToken = state.tokens.find((t) => t.playerId === 'p-red')!
    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const redStart = 0
    const steps = redPos - redStart

    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === redToken.id) return { ...t, state: 'on_track' as const, position: redStart }
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: bluePos }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-red',
        phase: 'waiting_choice',
        diceResult: steps,
        legalMoves: [],
      },
      phase: 'waiting_choice',
    }

    const rolled = handleRoll(
      {
        ...state,
        turn: { ...state.turn, phase: 'waiting_roll', diceResult: null },
        phase: 'waiting_roll',
      },
      'p-red',
      () => steps,
    )
    expect(rolled.success).toBe(true)
    if (!rolled.success) return

    const blueAfter = rolled.state.tokens.find((t) => t.id === blueToken.id)!
    expect(blueAfter.state).toBe('in_base')
  })

  it('blue landing on red cell captures red (non-safe)', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: false,
    })

    const cell = sharedCellPositions(state, { excludeSafe: true })
    expect(cell).not.toBeNull()
    const { redPos, bluePos } = cell!

    const redToken = state.tokens.find((t) => t.playerId === 'p-red')!
    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const blueStart = 0
    const steps = bluePos - blueStart

    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === redToken.id) return { ...t, state: 'on_track' as const, position: redPos }
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: blueStart }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-blue',
        phase: 'waiting_roll',
        diceResult: null,
        legalMoves: [],
      },
      phase: 'waiting_roll',
    }

    const rolled = handleRoll(state, 'p-blue', () => steps)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return

    const redAfter = rolled.state.tokens.find((t) => t.id === redToken.id)!
    expect(redAfter.state).toBe('in_base')
  })

  it('rune move path captures like traditional move', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-red',
      runesEnabled: true,
    })

    const cell = sharedCellPositions(state, { excludeSafe: true })
    expect(cell).not.toBeNull()
    const { redPos, bluePos } = cell!

    const redToken = state.tokens.find((t) => t.playerId === 'p-red')!
    state = {
      ...state,
      tokens: state.tokens.map((t) =>
        t.id === redToken.id ? { ...t, state: 'on_track' as const, position: 0 } : t,
      ),
    }
    const redOnTrack = state.tokens.find((t) => t.id === redToken.id)!
    const blueToken = state.tokens.find((t) => t.playerId === 'p-blue')!
    const steps = redPos - redOnTrack.position

    state = {
      ...state,
      tokens: state.tokens.map((t) => {
        if (t.id === blueToken.id) return { ...t, state: 'on_track' as const, position: bluePos }
        return t
      }),
      turn: {
        ...state.turn,
        currentPlayerId: 'p-red',
        phase: 'waiting_choice',
        diceResult: steps,
        legalMoves: [
          {
            id: 'cap',
            tokenId: redToken.id,
            moveType: 'capture',
            destination: redPos,
            capturedTokenId: blueToken.id,
          },
        ],
      },
      phase: 'waiting_choice',
    }

    const after = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const blueAfter = after.tokens.find((t) => t.id === blueToken.id)!
    expect(blueAfter.state).toBe('in_base')
  })
})
