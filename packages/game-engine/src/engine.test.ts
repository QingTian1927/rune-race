import { describe, expect, it } from 'vitest'
import { PLAYER_COLORS } from '@rune-race/shared'
import {
  createInitialGameState,
  removePlayerFromGame,
  resolveTurn,
  rollTurn,
  shouldEndGameByFinishCount,
  sortPlayersByColor,
} from './engine.js'

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

describe('removePlayerFromGame', () => {
  const threePlayers = [
    { id: 'p-red', name: 'Red', color: 'red' as const },
    { id: 'p-blue', name: 'Blue', color: 'blue' as const },
    { id: 'p-green', name: 'Green', color: 'green' as const },
  ]

  it('advances turn when the leaving player held the turn', () => {
    const state = createInitialGameState({
      gameId: 'g1',
      players: threePlayers,
      firstPlayerId: 'p-red',
    })

    const after = removePlayerFromGame(state, 'p-red')

    expect(after.players.map((p) => p.id)).toEqual(['p-blue', 'p-green'])
    expect(after.tokens.every((t) => t.playerId !== 'p-red')).toBe(true)
    expect(after.turn.currentPlayerId).not.toBe('p-red')
    expect(after.turn.phase).toBe('waiting_roll')
    expect(after.status).toBe('playing')
  })

  it('ends the game when only one player remains', () => {
    let state = createInitialGameState({
      gameId: 'g1',
      players: threePlayers,
      firstPlayerId: 'p-red',
    })
    state = removePlayerFromGame(state, 'p-blue')
    state = removePlayerFromGame(state, 'p-green')

    expect(state.status).toBe('finished')
    expect(state.winnerId).toBe('p-red')
    expect(state.players).toHaveLength(1)
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
