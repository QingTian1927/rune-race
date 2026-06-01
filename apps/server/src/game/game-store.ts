import type { GameState } from '@rune-race/shared'
import {
  createInitialGameState,
  handleChooseMove,
  handlePlayerLeft,
  handleRoll,
} from '@rune-race/game-engine'

export type GameChangeListener = (gameId: string, state: GameState, events: GameState['events']) => void
export type GameFinishedListener = (gameId: string, lobbyId: string, state: GameState) => void

interface GameSession {
  gameId: string
  lobbyId: string
  state: GameState
}

export class GameStore {
  private games = new Map<string, GameSession>()
  private playerGameIndex = new Map<string, string>()
  private onChange: GameChangeListener | null = null
  private onFinished: GameFinishedListener | null = null

  setListeners(listeners: {
    onChange?: GameChangeListener
    onFinished?: GameFinishedListener
  }): void {
    this.onChange = listeners.onChange ?? null
    this.onFinished = listeners.onFinished ?? null
  }

  createGame(params: {
    gameId: string
    lobbyId: string
    players: Parameters<typeof createInitialGameState>[0]['players']
    firstPlayerId: string
  }): GameState {
    const state = createInitialGameState({
      gameId: params.gameId,
      players: params.players,
      firstPlayerId: params.firstPlayerId,
    })

    this.games.set(params.gameId, {
      gameId: params.gameId,
      lobbyId: params.lobbyId,
      state,
    })

    for (const player of params.players) {
      this.playerGameIndex.set(player.id, params.gameId)
    }

    return state
  }

  getState(gameId: string): GameState | undefined {
    return this.games.get(gameId)?.state
  }

  getLobbyId(gameId: string): string | undefined {
    return this.games.get(gameId)?.lobbyId
  }

  getGameIdForPlayer(playerId: string): string | undefined {
    return this.playerGameIndex.get(playerId)
  }

  getActiveGameCount(): number {
    let count = 0
    for (const game of this.games.values()) {
      if (game.state.status !== 'finished') count += 1
    }
    return count
  }

  roll(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')

    const result = handleRoll(session.state, playerId)
    if (!result.success) {
      throw new Error(result.error.message)
    }

    session.state = result.state
    this.onChange?.(gameId, session.state, result.events)

    if (session.state.status === 'finished') {
      this.onFinished?.(gameId, session.lobbyId, session.state)
    }
  }

  removePlayer(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session || session.state.status === 'finished') return

    const result = handlePlayerLeft(session.state, playerId)
    if (!result.success) return

    session.state = result.state
    this.playerGameIndex.delete(playerId)
    this.onChange?.(gameId, session.state, result.events)

    if (session.state.status === 'finished') {
      this.onFinished?.(gameId, session.lobbyId, session.state)
    }
  }

  chooseMove(gameId: string, playerId: string, moveId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')

    const result = handleChooseMove(session.state, playerId, moveId)
    if (!result.success) {
      throw new Error(result.error.message)
    }

    session.state = result.state
    this.onChange?.(gameId, session.state, result.events)

    if (session.state.status === 'finished') {
      this.onFinished?.(gameId, session.lobbyId, session.state)
    }
  }
}
