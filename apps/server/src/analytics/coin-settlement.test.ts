import { describe, expect, it } from 'vitest'
import type { GameState } from '@rune-race/shared'
import {
  COIN_CAPTURE_ENEMY,
  COIN_FINISH_BASE,
  COIN_SELF_KICK_PENALTY,
  computeCoinSettlement,
  computeFinishCoins,
} from '@rune-race/shared'

function minimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'game-1',
    version: 1,
    status: 'finished',
    players: [
      { id: 'p1', name: 'A', color: 'red' },
      { id: 'p2', name: 'B', color: 'blue' },
      { id: 'p3', name: 'C', color: 'green' },
      { id: 'p4', name: 'D', color: 'yellow' },
    ],
    tokens: [],
    turn: {
      id: 't1',
      currentPlayerId: 'p1',
      diceResult: null,
      phase: 'turn_end',
      legalMoves: [],
      startTime: 0,
    },
    phase: 'turn_end',
    currentPlayerIndex: 0,
    events: [],
    winnerId: 'p1',
    updatedAt: 0,
    config: { runesEnabled: true },
    rune: null,
    ...overrides,
  }
}

describe('computeFinishCoins', () => {
  it('gives base coins to unfinished players', () => {
    expect(computeFinishCoins(null, 4, 3)).toBe(COIN_FINISH_BASE)
  })

  it('gives base coins to last ranked finisher when more than one finished', () => {
    expect(computeFinishCoins(3, 4, 3)).toBe(COIN_FINISH_BASE)
  })

  it('gives multiplied coins to first place in a 4-player game', () => {
    expect(computeFinishCoins(1, 4, 3)).toBe(1600)
  })

  it('gives multiplied coins to sole finisher in a 2-player game', () => {
    expect(computeFinishCoins(1, 2, 1)).toBe(800)
  })
})

describe('computeCoinSettlement', () => {
  it('awards capture and finish coins', () => {
    const state = minimalState({
      events: [
        {
          type: 'token_captured',
          timestamp: 1,
          playerId: 'p1',
          details: {
            capturedTokenId: 'p2:0',
            capturedPlayerId: 'p2',
            isFriendlyCapture: false,
          },
        },
        {
          type: 'token_finished',
          timestamp: 2,
          playerId: 'p1',
          details: { playerId: 'p1', rank: 1 },
        },
        {
          type: 'token_finished',
          timestamp: 3,
          playerId: 'p2',
          details: { playerId: 'p2', rank: 2 },
        },
        {
          type: 'token_finished',
          timestamp: 4,
          playerId: 'p3',
          details: { playerId: 'p3', rank: 3 },
        },
      ],
    })

    const settlement = computeCoinSettlement(state)
    expect(settlement.p1?.capture).toBe(COIN_CAPTURE_ENEMY)
    expect(settlement.p1?.finish).toBe(1600)
    expect(settlement.p2?.finish).toBe(800)
    expect(settlement.p3?.finish).toBe(COIN_FINISH_BASE)
    expect(settlement.p4?.finish).toBe(COIN_FINISH_BASE)
    expect(settlement.p4?.total).toBe(COIN_FINISH_BASE)
  })

  it('ignores bots for capture and finish rewards', () => {
    const state = minimalState({
      players: [
        { id: 'p1', name: 'A', color: 'red' },
        { id: 'bot-abc', name: 'Bot', color: 'blue' },
      ],
      events: [
        {
          type: 'token_captured',
          timestamp: 1,
          playerId: 'bot-abc',
          details: {
            capturedTokenId: 'p1:0',
            capturedPlayerId: 'p1',
            isFriendlyCapture: false,
          },
        },
        {
          type: 'token_captured',
          timestamp: 2,
          playerId: 'p1',
          details: {
            capturedTokenId: 'bot-abc:0',
            capturedPlayerId: 'bot-abc',
            isFriendlyCapture: false,
          },
        },
        {
          type: 'token_finished',
          timestamp: 3,
          playerId: 'bot-abc',
          details: { playerId: 'bot-abc', rank: 1 },
        },
        {
          type: 'token_finished',
          timestamp: 4,
          playerId: 'p1',
          details: { playerId: 'p1', rank: 2 },
        },
      ],
    })

    const settlement = computeCoinSettlement(state)
    expect(settlement['bot-abc']).toBeUndefined()
    expect(settlement.p1?.capture).toBe(COIN_CAPTURE_ENEMY)
    expect(settlement.p1?.finish).toBe(COIN_FINISH_BASE)
  })

  it('penalizes friendly captures', () => {
    const state = minimalState({
      players: [
        { id: 'p1', name: 'A', color: 'red' },
        { id: 'p2', name: 'B', color: 'blue' },
      ],
      events: [
        {
          type: 'token_captured',
          timestamp: 1,
          playerId: 'p1',
          details: {
            capturedTokenId: 'p1:1',
            capturedPlayerId: 'p1',
            isFriendlyCapture: true,
          },
        },
        {
          type: 'token_finished',
          timestamp: 2,
          playerId: 'p1',
          details: { playerId: 'p1', rank: 1 },
        },
      ],
    })

    const settlement = computeCoinSettlement(state)
    expect(settlement.p1?.capture).toBe(-COIN_SELF_KICK_PENALTY)
    expect(settlement.p1?.finish).toBe(800)
    expect(settlement.p1?.total).toBe(800 - COIN_SELF_KICK_PENALTY)
  })
})
