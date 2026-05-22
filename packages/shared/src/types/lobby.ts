/**
 * Lobby domain types (pre-game room).
 */

import type { PlayerColor } from './game'

export type LobbyStatus = 'lobby' | 'countdown' | 'in_game'

export interface LobbySettings {
  name: string
  hasPassword: boolean
  maxPlayers: number
  minPlayersToStart: number
}

export interface LobbyPlayer {
  id: string
  name: string
  color: PlayerColor | null
  ready: boolean
  connected: boolean
  isHost: boolean
}

/** Public lobby list entry (HTTP). */
export interface LobbyListItem {
  lobbyId: string
  joinCode: string
  name: string
  playerCount: number
  maxPlayers: number
  hasPassword: boolean
  status: LobbyStatus
}

/** Full lobby snapshot for socket clients. */
export interface LobbySnapshot {
  lobbyId: string
  joinCode: string
  status: LobbyStatus
  settings: LobbySettings
  players: LobbyPlayer[]
  takenColors: PlayerColor[]
  playerCount: number
  countdownSeconds: number | null
  currentGameId: string | null
  canCountdown: boolean
}

export const LOBBY_MAX_PLAYERS = 4
export const LOBBY_MIN_PLAYERS_TO_START = 2
export const LOBBY_START_COUNTDOWN_SECONDS = 5
export const JOIN_CODE_LENGTH = 8

/** Matchmaking timing (seconds). */
export const MATCHMAKING_TIER_4_SECONDS = 20
export const MATCHMAKING_TIER_3_SECONDS = 40
export const MATCHMAKING_TIER_2_SECONDS = 60

/** Disconnect grace (milliseconds). */
export const LOBBY_DISCONNECT_GRACE_MS = 90_000
export const GAME_DISCONNECT_GRACE_MS = 120_000
