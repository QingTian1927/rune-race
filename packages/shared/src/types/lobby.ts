/**
 * Lobby domain types (pre-game room).
 */

import type { PlayerColor } from './game.js'

export type LobbyStatus = 'lobby' | 'countdown' | 'in_game'

export interface LobbySettings {
  name: string
  hasPassword: boolean
  maxPlayers: number
  minPlayersToStart: number
  /** Host toggle — default true when room is created. */
  runesEnabled: boolean
}

export interface LobbyPlayer {
  id: string
  name: string
  color: PlayerColor | null
  ready: boolean
  connected: boolean
  isHost: boolean
  /** True for server-controlled bot players. */
  isBot?: boolean
}

/** Public lobby list entry (HTTP). */
export interface LobbyListItem {
  lobbyId: string
  joinCode: string
  name: string
  /** Human players seated (excludes bots). */
  humanPlayerCount: number
  botCount: number
  /** @deprecated Use humanPlayerCount — kept for older clients. */
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
export const MATCHMAKING_TIER_4_SECONDS = 0
export const MATCHMAKING_TIER_3_SECONDS = 7
export const MATCHMAKING_TIER_2_SECONDS = 4
/** Solo queue — fill remaining slots with bots after this wait. */
export const MATCHMAKING_SOLO_BOT_SECONDS = 18

/** Disconnect grace (milliseconds) — accidental disconnect only; active leave is immediate. */
export const LOBBY_DISCONNECT_GRACE_MS = 30_000
export const GAME_DISCONNECT_GRACE_MS = 120_000
