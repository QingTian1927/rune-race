import { describe, expect, it } from 'vitest'
import { PLAYER_COLORS } from '@rune-race/shared'
import {
  createInitialGameState,
  resolveTurn,
  rollTurn,
  shouldEndGameByFinishCount,
  sortPlayersByColor,
} from './engine'

describe('createInitialGameState', () => {
  it('sorts players by color order and sets first player', () => {
    const state = createInitialGameState({
      gameId: 'g1',
      players: [
        { id: 'p-yellow', name: 'Y', color: 'yellow' },
        { id: 'p-red', name: 'R', color: 'red' },
      ],
      firstPlayerId: 'p-yellow',
    })

    expect(state.players.map((p) => p.color)).toEqual(['red', 'yellow'])
    expect(state.turn.currentPlayerId).toBe('p-yellow')
    expect(state.currentPlayerIndex).toBe(1)
  })
})

describe('spawn rules', () => {
  const twoPlayers = PLAYER_COLORS.slice(0, 2).map((color) => ({
    id: `p-${color}`,
    name: color,
    color,
  }))

  it('allows spawn on 1', () => {
    const state = createInitialGameState({
      gameId: 'g1',
      players: twoPlayers,
      firstPlayerId: twoPlayers[0].id,
    })
    const rolled = rollTurn(state, () => 1)
    expect(rolled.turn.legalMoves.some((m) => m.moveType === 'spawn')).toBe(true)
  })

  it('allows spawn on 6', () => {
    const state = createInitialGameState({
      gameId: 'g1',
      players: twoPlayers,
      firstPlayerId: twoPlayers[0].id,
    })
    const rolled = rollTurn(state, () => 6)
    expect(rolled.turn.legalMoves.some((m) => m.moveType === 'spawn')).toBe(true)
  })
})

describe('extra turn on 6', () => {
  const twoPlayers = [
    { id: 'p-green', name: 'Green', color: 'green' as const },
    { id: 'p-yellow', name: 'Yellow', color: 'yellow' as const },
  ]

  it('keeps the same player after rolling 6 and resolving spawn', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players: twoPlayers,
      firstPlayerId: 'p-green',
    })

    state = rollTurn(state, () => 6)
    expect(state.turn.diceResult).toBe(6)
    state = resolveTurn(state)

    expect(state.turn.currentPlayerId).toBe('p-green')
    expect(state.turn.phase).toBe('waiting_roll')
    expect(state.currentPlayerIndex).toBe(0)
  })
})

describe('shouldEndGameByFinishCount', () => {
  const cases: Array<{ players: number; finished: number; ends: boolean }> = [
    { players: 3, finished: 1, ends: false },
    { players: 3, finished: 2, ends: true },
    { players: 4, finished: 2, ends: false },
    { players: 4, finished: 3, ends: true },
    { players: 2, finished: 1, ends: true },
  ]

  cases.forEach(({ players, finished, ends }) => {
    it(`${finished}/${players} finished => ${ends ? 'game over' : 'continue'}`, () => {
      expect(shouldEndGameByFinishCount(players, finished)).toBe(ends)
    })
  })
})

describe('sortPlayersByColor', () => {
  it('orders by PLAYER_COLORS', () => {
    const sorted = sortPlayersByColor([
      { id: '3', name: 'G', color: 'green' },
      { id: '1', name: 'R', color: 'red' },
      { id: '4', name: 'Y', color: 'yellow' },
    ])
    expect(sorted.map((p) => p.color)).toEqual(['red', 'green', 'yellow'])
  })
})
