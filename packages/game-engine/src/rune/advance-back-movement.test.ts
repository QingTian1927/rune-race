import { describe, expect, it } from 'vitest'
import { createInitialGameState, boardSlotForPlayer, absoluteTrackIndexFor } from '../engine.js'
import { handleChooseMove } from '../commands.js'
import { placeMarker } from './placement.js'
import { resolveMoveWithRunes } from './movement.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function withMarker(
  state: ReturnType<typeof createInitialGameState>,
  placerId: string,
  cellId: number,
  cardType: 'ADVANCE_2' | 'ADVANCE_3' | 'BACK_4' | 'BACK_5',
  heldCardId: string,
) {
  const placement = {
    phaseId: 'test-placement',
    openedAt: Date.now(),
    minCloseAt: Date.now(),
    maxCloseAt: Date.now() + 60_000,
    honestyByPlayer: {},
  }
  const player = state.rune!.players[placerId]
  const withPhase = {
    ...state,
    turn: { ...state.turn, phase: 'placement_phase' as const, currentPlayerId: placerId },
    phase: 'placement_phase' as const,
    rune: {
      ...state.rune!,
      placement,
      players: {
        ...state.rune!.players,
        [placerId]: {
          ...player,
          hand: [
            ...player.hand,
            {
              heldCardId,
              ownerPlayerId: placerId,
              cardType,
              remainingHandRounds: 2,
              source: 'DRAW' as const,
            },
          ],
        },
      },
    },
  }
  const { state: placed } = placeMarker(
    withPhase,
    placerId,
    heldCardId,
    cellId,
    placerId,
    Date.now(),
  )
  return placed
}

function moveBlueToken(
  state: ReturnType<typeof createInitialGameState>,
  moverStart: number,
  diceResult: number,
) {
  const mover = state.tokens.find((t) => t.playerId === 'p-blue' && t.state !== 'finished')!
  return {
    ...state,
    tokens: state.tokens.map((t) =>
      t.id === mover.id ? { ...t, state: 'on_track' as const, position: moverStart } : t,
    ),
    turn: {
      ...state.turn,
      currentPlayerId: 'p-blue',
      phase: 'waiting_choice' as const,
      diceResult,
      legalMoves: [
        {
          id: 'move-blue',
          tokenId: mover.id,
          moveType: 'move' as const,
          destination: moverStart + diceResult,
        },
      ],
    },
    phase: 'waiting_choice' as const,
  }
}

describe('ADVANCE vs BACK dice movement rules', () => {
  it('ADVANCE adds rune steps on top of remaining dice movement', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const moverStart = 5
    const advanceCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 1)
    state = withMarker(state, 'p-red', advanceCell, 'ADVANCE_3', 'adv')
    state = moveBlueToken(state, moverStart, 4)

    const after = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const mover = after.tokens.find((t) => t.playerId === 'p-blue' && t.state === 'on_track')!

    // 1 dice step to marker + 3 remaining dice + 3 advance = 7 cells from start
    expect(mover.position).toBe(moverStart + 7)
  })

  it('BACK cancels remaining dice and only moves back N rune steps', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const moverStart = 10
    const backCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 1)
    state = withMarker(state, 'p-red', backCell, 'BACK_5', 'back')
    state = moveBlueToken(state, moverStart, 4)

    const after = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const mover = after.tokens.find((t) => t.playerId === 'p-blue' && t.state === 'on_track')!

    // 1 dice step to marker + 5 back = net -4 from start
    expect(mover.position).toBe(moverStart - 4)

    const path = after.events.find((e) => e.type === 'token_moved')?.details?.path ?? []
    const stepPositions = path
      .filter((step) => step.motion !== 'teleport')
      .map((step) => step.position)
    const teleportPositions = path
      .filter((step) => step.motion === 'teleport')
      .map((step) => step.position)
    expect(stepPositions).toEqual([moverStart + 1])
    expect(teleportPositions).toEqual([moverStart - 4])
  })

  it('TC-07: forward into BACK cancels unused dice steps (roll 4, BACK_4 one step ahead)', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const moverStart = 10
    const backCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 1)
    state = withMarker(state, 'p-red', backCell, 'BACK_4', 'back')
    state = moveBlueToken(state, moverStart, 4)

    const after = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const mover = after.tokens.find((t) => t.playerId === 'p-blue' && t.state === 'on_track')!

    // 1 forward + 4 back = net -3 (not -6 if 3 unused dice were also applied backward)
    expect(mover.position).toBe(moverStart - 3)
  })

  it('BACK cancels remaining ADVANCE burst and dice when hit mid-chain', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const moverStart = 5
    const advanceCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 1)
    const backCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 3)
    state = withMarker(state, 'p-red', advanceCell, 'ADVANCE_3', 'adv')
    state = withMarker(state, 'p-red', backCell, 'BACK_5', 'back')
    state = moveBlueToken(state, moverStart, 4)

    const after = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const mover = after.tokens.find((t) => t.playerId === 'p-blue' && t.state === 'on_track')!

    // 1 dice step + 2 advance rune steps to BACK, then 5 back (unused dice + advance cancelled)
    expect(mover.position).toBe(moverStart + 3 - 5)
  })

  it('handleChooseMove applies BACK cancel rules through command API', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const moverStart = 10
    const backCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 1)
    state = withMarker(state, 'p-red', backCell, 'BACK_5', 'back')
    state = moveBlueToken(state, moverStart, 4)

    const result = handleChooseMove(state, 'p-blue', 'move-blue')
    expect(result.success).toBe(true)
    if (!result.success) return

    const mover = result.state.tokens.find((t) => t.playerId === 'p-blue' && t.state === 'on_track')!
    expect(mover.position).toBe(moverStart - 4)
  })

  it('BACK cancels dice even when marker is multiple steps away', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players,
      firstPlayerId: 'p-blue',
      runesEnabled: true,
    })

    const moverStart = 10
    const backCell = absoluteTrackIndexFor(boardSlotForPlayer(state, 'p-blue'), moverStart + 2)
    state = withMarker(state, 'p-red', backCell, 'BACK_5', 'back')
    state = moveBlueToken(state, moverStart, 4)

    const after = resolveMoveWithRunes(state, state.turn.legalMoves[0]!)
    const mover = after.tokens.find((t) => t.playerId === 'p-blue' && t.state === 'on_track')!

    // 2 dice steps to marker + 5 back = net -3 from start (not -3 - 2 extra dice)
    expect(mover.position).toBe(moverStart - 3)
  })
})
