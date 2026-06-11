import type { GameState, RuneCardType } from '@rune-race/shared'
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
  handleSelectHonestyReward,
  handleUseLeaveStable,
  tickPlacementPhase,
} from '@rune-race/game-engine'

export type GameChangeListener = (gameId: string, state: GameState, events: GameState['events']) => void
export type GameFinishedListener = (gameId: string, lobbyId: string, state: GameState) => void

const TURN_ROLL_TIMEOUT_MS = 10_000
const TURN_MOVE_CHOICE_TIMEOUT_MS = 20_000

interface GameSession {
  gameId: string
  lobbyId: string
  state: GameState
}

interface TurnTimeoutTrack {
  key: string
  startedAt: number
}

export class GameStore {
  private games = new Map<string, GameSession>()
  private playerGameIndex = new Map<string, string>()
  private turnTimeouts = new Map<string, TurnTimeoutTrack>()
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

    this.syncTurnTimeout(params.gameId, state)

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

  private turnTimeoutKey(state: GameState): string | null {
    if (state.status !== 'playing') return null
    const phase = state.turn.phase
    if (phase === 'waiting_roll' || phase === 'leave_stable_phase') {
      return `${state.turn.id}:roll`
    }
    if (phase === 'waiting_choice' && state.turn.legalMoves.length > 1) {
      return `${state.turn.id}:choice`
    }
    return null
  }

  private syncTurnTimeout(gameId: string, state: GameState): void {
    const key = this.turnTimeoutKey(state)
    if (!key) {
      this.turnTimeouts.delete(gameId)
      return
    }
    const existing = this.turnTimeouts.get(gameId)
    if (!existing || existing.key !== key) {
      this.turnTimeouts.set(gameId, { key, startedAt: Date.now() })
    }
  }

  private commitState(gameId: string, session: GameSession, state: GameState, events: GameState['events']): void {
    session.state = state
    this.syncTurnTimeout(gameId, state)
    this.onChange?.(gameId, state, events)
    if (state.status === 'finished') {
      this.turnTimeouts.delete(gameId)
      this.onFinished?.(gameId, session.lobbyId, state)
    }
  }

  tickTurnTimeouts(): void {
    const now = Date.now()
    for (const [gameId, session] of this.games) {
      const state = session.state
      if (state.status !== 'playing') continue

      const track = this.turnTimeouts.get(gameId)
      if (!track) continue

      const phase = state.turn.phase
      const playerId = state.turn.currentPlayerId

      if (track.key.endsWith(':roll') && (phase === 'waiting_roll' || phase === 'leave_stable_phase')) {
        if (now - track.startedAt < TURN_ROLL_TIMEOUT_MS) continue
        try {
          this.roll(gameId, playerId)
        } catch {
          // Phase may have changed between tick and roll.
        }
        continue
      }

      if (
        track.key.endsWith(':choice') &&
        phase === 'waiting_choice' &&
        state.turn.legalMoves.length > 1 &&
        now - track.startedAt >= TURN_MOVE_CHOICE_TIMEOUT_MS
      ) {
        const first = state.turn.legalMoves[0]
        if (!first) continue
        try {
          this.chooseMove(gameId, playerId, first.id)
        } catch {
          // Phase may have changed between tick and choose.
        }
      }
    }
  }

  roll(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')

    const result = handleRoll(session.state, playerId)
    if (!result.success) {
      throw new Error(result.error.message)
    }

    this.commitState(gameId, session, result.state, result.events)
  }

  removePlayer(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session || session.state.status === 'finished') return

    const result = handlePlayerLeft(session.state, playerId)
    if (!result.success) return

    this.playerGameIndex.delete(playerId)
    this.commitState(gameId, session, result.state, result.events)
  }

  drawCards(gameId: string, playerId: string, count: number): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleDrawCards(session.state, playerId, count)
    if (!result.success) throw new Error(result.error.message)
    this.commitState(gameId, session, result.state, result.events)
  }

  finishDraw(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleFinishDraw(session.state, playerId)
    if (!result.success) throw new Error(result.error.message)
    this.commitState(gameId, session, result.state, result.events)
  }

  confirmDraw(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleConfirmDraw(session.state, playerId)
    if (!result.success) throw new Error(result.error.message)
    this.commitState(gameId, session, result.state, result.events)
  }

  useLeaveStable(gameId: string, playerId: string, heldCardId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleUseLeaveStable(session.state, playerId, heldCardId)
    if (!result.success) throw new Error(result.error.message)
    this.commitState(gameId, session, result.state, result.events)
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
    this.commitState(gameId, session, result.state, result.events)
  }

  confirmPlacementReady(gameId: string, playerId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleConfirmPlacementReady(session.state, playerId)
    if (!result.success) throw new Error(result.error.message)
    this.commitState(gameId, session, result.state, result.events)
  }

  selectHonestyReward(gameId: string, playerId: string, cardType: RuneCardType): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleSelectHonestyReward(session.state, playerId, cardType)
    if (!result.success) throw new Error(result.error.message)
    this.commitState(gameId, session, result.state, result.events)
  }

  tickPlacementPhases(): void {
    const timestamp = Date.now()
    for (const [gameId, session] of this.games) {
      if (session.state.status !== 'playing') continue
      if (session.state.turn.phase !== 'placement_phase') continue
      const before = session.state
      const next = tickPlacementPhase(before, timestamp)
      if (next === before) continue
      const events = next.events.slice(before.events.length)
      this.commitState(gameId, session, next, events)
    }
  }

  chooseSwap(gameId: string, playerId: string, targetTokenId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')
    const result = handleChooseSwap(session.state, playerId, targetTokenId)
    if (!result.success) throw new Error(result.error.message)
    this.commitState(gameId, session, result.state, result.events)
  }

  chooseMove(gameId: string, playerId: string, moveId: string): void {
    const session = this.games.get(gameId)
    if (!session) throw new Error('Game not found')

    const result = handleChooseMove(session.state, playerId, moveId)
    if (!result.success) {
      throw new Error(result.error.message)
    }

    this.commitState(gameId, session, result.state, result.events)
  }
}
