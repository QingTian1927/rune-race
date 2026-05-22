/**
 * Rune Race Game Domain Types
 * Shared between server and client for type safety and protocol consistency.
 */

/** Player color constants */
export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow'

/** Ordered player colors (for turn sequence) */
export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow']

/** Player information */
export interface Player {
  id: string
  name: string
  color: PlayerColor
}

/** Token position state within the game board */
export type TokenState = 'in_base' | 'on_track' | 'in_home_lane' | 'finished'

/**
 * Individual token (game piece)
 * Each player has 4 tokens.
 */
export interface Token {
  id: string // Format: "${playerId}:${tokenIndex}"
  playerId: string
  /** Current position on board (0-indexed). Meaning depends on tokenState. */
  position: number
  state: TokenState
}

/** Turn phase state machine */
export type GamePhase =
  | 'waiting_roll'
  | 'rolled'
  | 'waiting_choice'
  | 'resolving_move'
  | 'play_cards'
  | 'turn_end'

/**
 * Turn context for current active turn.
 * Immutable during turn; new instance created on turn transition.
 */
export interface Turn {
  id: string // Format: "${roomId}:turn:${number}"
  currentPlayerId: string
  diceResult: number | null // null until rolled
  phase: GamePhase
  legalMoves: LegalMove[]
  startTime: number // Unix timestamp
}

/**
 * Represents a valid move option.
 * Server computes all legal moves after dice roll; client receives this list.
 */
export interface LegalMove {
  id: string // Format: "${tokenId}:${destination}"
  tokenId: string
  destination: number // Where the token will land
  moveType: 'spawn' | 'move' | 'capture'
  capturedTokenId?: string // If capture, which token will be captured
}

/**
 * Event in the game log (animation + audit trail).
 */
export interface GameEvent {
  type: 'dice_roll' | 'token_moved' | 'token_captured' | 'token_finished' | 'turn_advanced' | 'error'
  timestamp: number
  playerId: string
  details: Record<string, unknown>
}

/** @deprecated Use LobbySnapshot from types/lobby — kept for migration. */
export type RoomStatus = 'lobby' | 'playing' | 'finished'

/** @deprecated Use LobbySnapshot */
export interface RoomSnapshot {
  roomId: string
  status: RoomStatus
  players: Player[]
  maxPlayers: number
  hostPlayerId: string | null
  canStart: boolean
}

/**
 * Complete game state.
 * Server is authoritative; clients receive snapshots and reconcile.
 */
export interface GameState {
  roomId: string
  version: number // Incremented on each state change; used for reconciliation
  players: Player[]
  tokens: Token[] // Flattened: all tokens from all players
  turn: Turn
  phase: GamePhase // Mirrors turn.phase for convenience
  status: 'waiting' | 'playing' | 'finished'
  currentPlayerIndex: number // Index into players array
  winnerId?: string // Set when status='finished'
  createdAt: number
  updatedAt: number
  events: GameEvent[] // Recent events for animation/audit (keep last N)
}
