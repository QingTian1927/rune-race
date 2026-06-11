import { describe, expect, it } from 'vitest'
import type { GameEvent, GameState } from '@rune-race/shared'
import { buildClientGameSnapshot, redactEventsForViewer, toPublicGameState } from '@rune-race/shared'
import { createInitialGameState } from '../engine.js'

const players = [
  { id: 'p-red', name: 'Red', color: 'red' as const },
  { id: 'p-blue', name: 'Blue', color: 'blue' as const },
]

function stateWithSecrets(): GameState {
  const state = createInitialGameState({
    gameId: 'g1',
    players,
    firstPlayerId: 'p-red',
    runesEnabled: true,
  })
  return {
    ...state,
    rune: {
      ...state.rune!,
      markers: [
        {
          markerId: 'm1',
          cellId: 3,
          cardType: 'SEND_HOME',
          realPlacerId: 'p-red',
          displayedIdentityId: 'p-blue',
          remainingMarkerRounds: 5,
          ttlMode: 'DISPLAYED_IDENTITY_TURN',
          createdAtPhaseId: 'phase-1',
        },
      ],
      players: {
        ...state.rune!.players,
        'p-red': {
          ...state.rune!.players['p-red']!,
          hand: [
            {
              heldCardId: 'h1',
              ownerPlayerId: 'p-red',
              cardType: 'SHIELD',
              remainingHandRounds: 2,
              source: 'DRAW',
            },
          ],
          honestPlacementStreak: 3,
          hasClaimableHonestyReward: true,
        },
      },
    },
  }
}

describe('per-viewer state redaction', () => {
  it('keeps the viewer rune state but hides opponent hands and streaks', () => {
    const state = stateWithSecrets()

    const ownView = toPublicGameState(state, 'p-red')
    expect(ownView.rune!.players['p-red']!.hand).toHaveLength(1)
    expect(ownView.rune!.players['p-red']!.honestPlacementStreak).toBe(3)

    const opponentView = toPublicGameState(state, 'p-blue')
    const redRune = opponentView.rune!.players['p-red']!
    expect(redRune.hand).toHaveLength(0)
    expect(redRune.pendingDraw).toBeNull()
    expect(redRune.honestPlacementStreak).toBe(0)
    expect(redRune.hasClaimableHonestyReward).toBe(false)
  })

  it('hides marker card type and real placer from snapshots', () => {
    const snapshot = buildClientGameSnapshot(stateWithSecrets(), 'p-blue', [])
    const marker = snapshot.state.rune!.markers[0] as unknown as Record<string, unknown>
    expect(marker.cardType).toBeUndefined()
    expect(marker.realPlacerId).toBeUndefined()
    expect(marker.displayedIdentityId).toBe('p-blue')
  })
})

describe('per-viewer event redaction', () => {
  const timestamp = Date.now()

  it('hides reward card type from other players but announces the recipient', () => {
    const events: GameEvent[] = [
      {
        type: 'honesty_reward_granted',
        timestamp,
        playerId: 'p-red',
        details: { playerId: 'p-red', cardType: 'SHIELD', heldCardId: 'h9', autoSelected: false },
      },
    ]

    const ownView = redactEventsForViewer(events, 'p-red')
    expect(ownView[0]!.details.cardType).toBe('SHIELD')

    const opponentView = redactEventsForViewer(events, 'p-blue')
    expect(opponentView).toHaveLength(1)
    expect(opponentView[0]!.details.playerId).toBe('p-red')
    expect(opponentView[0]!.details.cardType).toBeUndefined()
    expect(opponentView[0]!.details.heldCardId).toBeUndefined()
  })

  it('attributes marker_placed to the displayed identity for other viewers', () => {
    const events: GameEvent[] = [
      {
        type: 'marker_placed',
        timestamp,
        playerId: 'p-red',
        details: { markerId: 'm1', cellId: 3, displayedIdentityId: 'p-blue', heldCardId: 'h1' },
      },
    ]

    const opponentView = redactEventsForViewer(events, 'p-blue')
    expect(opponentView[0]!.playerId).toBe('p-blue')
    expect(opponentView[0]!.details.heldCardId).toBeUndefined()

    const ownView = redactEventsForViewer(events, 'p-red')
    expect(ownView[0]!.playerId).toBe('p-red')
  })

  it('drops private events for other viewers', () => {
    const events: GameEvent[] = [
      {
        type: 'card_draw_preview',
        timestamp,
        playerId: 'p-red',
        details: { cardType: 'SHIELD', heldCardId: 'h1' },
      },
      {
        type: 'honesty_reward_available',
        timestamp,
        playerId: 'p-red',
        details: { playerId: 'p-red' },
      },
      {
        type: 'held_card_expired',
        timestamp,
        playerId: 'p-red',
        details: { heldCardId: 'h1', cardType: 'SHIELD' },
      },
    ]

    expect(redactEventsForViewer(events, 'p-red')).toHaveLength(3)
    expect(redactEventsForViewer(events, 'p-blue')).toHaveLength(0)
  })

  it('strips drawn card types from other viewers but keeps the count', () => {
    const events: GameEvent[] = [
      {
        type: 'cards_drawn',
        timestamp,
        playerId: 'p-red',
        details: { count: 1, cardTypes: ['SHIELD'] },
      },
    ]

    const opponentView = redactEventsForViewer(events, 'p-blue')
    expect(opponentView[0]!.details.count).toBe(1)
    expect(opponentView[0]!.details.cardTypes).toBeUndefined()
  })
})
