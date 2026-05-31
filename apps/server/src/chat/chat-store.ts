import { randomUUID } from 'node:crypto'
import type { ChatMessage } from '@rune-race/shared'
import {
  CHAT_BUFFER_MAX,
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_TEXT_LENGTH,
  CHAT_RATE_LIMIT_MS,
} from '@rune-race/shared'
import type { LobbyStore } from '../lobby/lobby-store'

export class ChatStore {
  private messagesByLobby = new Map<string, ChatMessage[]>()
  private lastSentAtByPlayer = new Map<string, number>()

  clearLobby(lobbyId: string): void {
    this.messagesByLobby.delete(lobbyId)
    // Rate-limit keys are per-player; stale entries are harmless.
  }

  getHistory(lobbyId: string): ChatMessage[] {
    const all = this.messagesByLobby.get(lobbyId) ?? []
    return all.slice(-CHAT_HISTORY_LIMIT)
  }

  send(params: {
    lobbyId: string
    playerId: string
    text: string
    lobbyStore: LobbyStore
  }): ChatMessage {
    const { lobbyId, playerId, text, lobbyStore } = params

    const memberLobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
    if (memberLobbyId !== lobbyId) {
      throw new Error('Not in this lobby')
    }

    const snapshot = lobbyStore.getSnapshot(lobbyId)
    if (!snapshot) {
      throw new Error('Lobby not found')
    }

    const player = snapshot.players.find((p) => p.id === playerId)
    if (!player) {
      throw new Error('Player not in lobby')
    }

    const trimmed = text.trim()
    if (!trimmed) {
      throw new Error('Message is empty')
    }
    if (trimmed.length > CHAT_MAX_TEXT_LENGTH) {
      throw new Error('Message too long')
    }

    const now = Date.now()
    const lastSent = this.lastSentAtByPlayer.get(playerId) ?? 0
    if (now - lastSent < CHAT_RATE_LIMIT_MS) {
      throw new Error('Sending too fast')
    }
    this.lastSentAtByPlayer.set(playerId, now)

    const message: ChatMessage = {
      id: randomUUID(),
      lobbyId,
      playerId,
      playerName: player.name,
      playerColor: player.color,
      text: trimmed,
      sentAt: new Date(now).toISOString(),
      kind: 'user',
    }

    const buffer = this.messagesByLobby.get(lobbyId) ?? []
    buffer.push(message)
    while (buffer.length > CHAT_BUFFER_MAX) {
      buffer.shift()
    }
    this.messagesByLobby.set(lobbyId, buffer)

    return message
  }
}
