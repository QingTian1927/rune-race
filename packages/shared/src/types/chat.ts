/**
 * Lobby-scoped chat (in-memory on server; not persisted after room closes).
 */

import type { PlayerColor } from './game.js'

export type ChatMessageKind = 'user' | 'system'

export type ChatSystemEvent = 'player_joined' | 'player_left' | 'player_left_game'

export interface ChatMessage {
  id: string
  lobbyId: string
  playerId: string
  playerName: string
  playerColor: PlayerColor | null
  text: string
  sentAt: string
  kind: ChatMessageKind
  systemEvent?: ChatSystemEvent
}

export function formatSystemChatText(event: ChatSystemEvent, playerName: string): string {
  switch (event) {
    case 'player_joined':
      return `${playerName} đã vào phòng`
    case 'player_left':
      return `${playerName} đã rời phòng`
    case 'player_left_game':
      return `${playerName} đã rời game`
  }
}

export const CHAT_MAX_TEXT_LENGTH = 400
export const CHAT_RATE_LIMIT_MS = 2_000
export const CHAT_HISTORY_LIMIT = 80
export const CHAT_BUFFER_MAX = 100
