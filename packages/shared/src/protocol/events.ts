/**
 * WebSocket events protocol — lobby + game.
 */

import type { ChatMessage } from '../types/chat'
import type { GameState, GameEvent } from '../types/game'
import type { LobbySnapshot } from '../types/lobby'
import type { PlayerColor } from '../types/game'

/**
 * Server -> Client
 */
export interface ServerToClientEvents {
  // --- Lobby ---
  'lobby:connected': (payload: { playerId: string; lobbyId: string }) => void
  /** Host only — current room password for display (not broadcast to other players). */
  'lobby:host_secrets': (payload: { roomPassword: string | null }) => void
  'lobby:snapshot': (payload: LobbySnapshot) => void
  'lobby:start_countdown': (payload: { seconds: number }) => void
  'lobby:start_countdown_cancelled': (payload: { reason: string }) => void
  'lobby:game_started': (payload: {
    gameId: string
    lobbyId: string
    firstPlayerId: string
  }) => void
  'lobby:error': (payload: { message: string; code: string }) => void
  'lobby:closed': (payload: { lobbyId: string; reason: 'empty' }) => void
  'lobby:kicked': (payload: { lobbyId: string; reason: 'kicked' }) => void
  'lobby:removed': (payload: { lobbyId: string; reason: 'left' | 'disconnect_timeout' }) => void

  // --- Chat (lobby-scoped, lobby + in-game) ---
  'chat:message': (payload: ChatMessage) => void
  'chat:history': (payload: { lobbyId: string; messages: ChatMessage[] }) => void
  'chat:error': (payload: { message: string; code: string }) => void

  // --- Game ---
  'game:connected': (payload: { playerId: string; gameId: string }) => void
  'game:state_snapshot': (payload: {
    version: number
    state: GameState
    events: GameEvent[]
  }) => void
  'game:error': (payload: { message: string; code: string }) => void
  'game:turn_timeout_warning': (payload: { secondsRemaining: number }) => void
}

/**
 * Client -> Server
 */
export interface ClientToServerEvents {
  // --- Lobby ---
  'lobby:join': (payload: {
    playerId: string
    playerName: string
    lobbyId?: string
    joinCode?: string
    password?: string
  }) => void
  'lobby:set_color': (payload: { playerId: string; color: PlayerColor }) => void
  'lobby:ready': (payload: { playerId: string }) => void
  'lobby:unready': (payload: { playerId: string }) => void
  'lobby:leave': (payload: { playerId: string }) => void
  'lobby:kick': (payload: { playerId: string; targetPlayerId: string }) => void
  'lobby:cancel_countdown': (payload: { playerId: string }) => void
  'lobby:update_settings': (payload: {
    playerId: string
    name?: string
    password?: string
    clearPassword?: boolean
  }) => void
  'lobby:transfer_host': (payload: {
    playerId: string
    newHostPlayerId: string
  }) => void
  'lobby:sync_request': (payload: { playerId: string }) => void

  // --- Chat ---
  'chat:send': (payload: { playerId: string; lobbyId: string; text: string }) => void
  'chat:sync_request': (payload: { playerId: string; lobbyId: string }) => void

  // --- Game ---
  'game:join': (payload: { playerId: string; gameId: string }) => void
  'game:roll': (payload: { playerId: string }) => void
  'game:choose_move': (payload: { playerId: string; moveId: string }) => void
  'game:sync_request': (payload: { playerId: string }) => void
  'game:ping': (payload: { playerId: string }) => void
}

export type GameEventKey = keyof ServerToClientEvents | keyof ClientToServerEvents

export const TURN_TIMEOUT_SECONDS = 30
export const TURN_WARNING_AT_SECONDS = 5
