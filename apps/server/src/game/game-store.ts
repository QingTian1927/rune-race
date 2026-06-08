import type { GameState } from '@rune-race/shared'
import {
  createInitialGameState,
  handleChooseMove,
  handleChooseSwap,
  handleDrawCards,
  handleConfirmDraw,
  handleFinishDraw,
  handleConfirmPlacementReady,
  handlePlaceMarker,
  handlePlayerLeft,
  handleRoll,
  handleUseLeaveStable,
  tickPlacementPhase,
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
    runesEnabled?: boolean
  }): GameState {
    const state = createInitialGameState({
      gameId: params.gameId,
      players: params.players,
      firstPlayerId: params.firstPlayerId,
      runesEnabled: params.runesEnabled ?? true,
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

  drawCards(gameId: string, playerId: string, count: number): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleDrawCards(session.state, playerId, count)
    if (!result.success) throw new Error(result.error.message)
    session.state = result.state
    this.onChange?.(gameId, session.state, result.events)
  }

  finishDraw(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleFinishDraw(session.state, playerId)
    if (!result.success) throw new Error(result.error.message)
    session.state = result.state
    this.onChange?.(gameId, session.state, result.events)
  }

  confirmDraw(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleConfirmDraw(session.state, playerId)
    if (!result.success) throw new Error(result.error.message)
    session.state = result.state
    this.onChange?.(gameId, session.state, result.events)
  }

  useLeaveStable(gameId: string, playerId: string, heldCardId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleUseLeaveStable(session.state, playerId, heldCardId)
    if (!result.success) throw new Error(result.error.message)
    session.state = result.state
    this.onChange?.(gameId, session.state, result.events)
  }

  placeMarker(
    gameId: string,
    playerId: string,
    heldCardId: string,
    cellId: number,
    displayedIdentityId: string,
  ): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handlePlaceMarker(session.state, playerId, heldCardId, cellId, displayedIdentityId)
    if (!result.success) throw new Error(result.error.message)
    session.state = result.state
    this.onChange?.(gameId, session.state, result.events)
  }

  confirmPlacementReady(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleConfirmPlacementReady(session.state, playerId)
    if (!result.success) throw new Error(result.error.message)
    session.state = result.state
    this.onChange?.(gameId, session.state, result.events)
  }

  tickPlacementPhases(): void {
    const timestamp = Date.now()
    for (const [gameId, session] of this.games) {
      if (session.state.status !== 'playing') continue
      if (session.state.turn.phase !== 'placement_phase') continue
      const before = session.state
      const next = tickPlacementPhase(before, timestamp)
      if (next === before) continue
      session.state = next
      const events = next.events.slice(before.events.length)
      this.onChange?.(gameId, next, events)
    }
  }

  chooseSwap(gameId: string, playerId: string, targetTokenId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleChooseSwap(session.state, playerId, targetTokenId)
    if (!result.success) throw new Error(result.error.message)
    session.state = result.state
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
