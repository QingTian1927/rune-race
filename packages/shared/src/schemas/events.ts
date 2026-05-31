/**
 * Zod schemas for WebSocket command validation.
 */

import { z } from 'zod'
import { CHAT_MAX_TEXT_LENGTH } from '../types/chat.js'

const PlayerColorSchema = z.enum(['red', 'blue', 'green', 'yellow'])

// --- Lobby ---
export const LobbyJoinSchema = z
  .object({
    playerId: z.string().min(1),
    playerName: z.string().min(1).max(50),
    lobbyId: z.string().min(1).optional(),
    joinCode: z.string().min(1).optional(),
    password: z.string().optional(),
  })
  .refine((d) => Boolean(d.lobbyId) || Boolean(d.joinCode), {
    message: 'lobbyId or joinCode is required',
  })

export const LobbySetColorSchema = z.object({
  playerId: z.string().min(1),
  color: PlayerColorSchema,
})

export const LobbyPlayerIdSchema = z.object({
  playerId: z.string().min(1),
})

export const LobbyKickSchema = z.object({
  playerId: z.string().min(1),
  targetPlayerId: z.string().min(1),
})

export const LobbyUpdateSettingsSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(1).max(64).optional(),
  clearPassword: z.boolean().optional(),
})

export const LobbyTransferHostSchema = z.object({
  playerId: z.string().min(1),
  newHostPlayerId: z.string().min(1),
})

// --- Game ---
export const GameJoinSchema = z.object({
  playerId: z.string().min(1),
  gameId: z.string().min(1),
})

export const RollDiceSchema = z.object({
  playerId: z.string().min(1),
})

export const ChooseMoveSchema = z.object({
  playerId: z.string().min(1),
  moveId: z.string().min(1),
})

export const SyncRequestSchema = z.object({
  playerId: z.string().min(1),
})

export const PingSchema = z.object({
  playerId: z.string().min(1),
})

export const ChatSendSchema = z.object({
  playerId: z.string().min(1),
  lobbyId: z.string().min(1),
  text: z.string().min(1).max(CHAT_MAX_TEXT_LENGTH),
})

export const ChatSyncRequestSchema = z.object({
  playerId: z.string().min(1),
  lobbyId: z.string().min(1),
})

const schemas: Record<string, z.ZodSchema> = {
  'lobby:join': LobbyJoinSchema,
  'lobby:set_color': LobbySetColorSchema,
  'lobby:ready': LobbyPlayerIdSchema,
  'lobby:unready': LobbyPlayerIdSchema,
  'lobby:leave': LobbyPlayerIdSchema,
  'lobby:kick': LobbyKickSchema,
  'lobby:cancel_countdown': LobbyPlayerIdSchema,
  'lobby:update_settings': LobbyUpdateSettingsSchema,
  'lobby:transfer_host': LobbyTransferHostSchema,
  'lobby:sync_request': LobbyPlayerIdSchema,
  'chat:send': ChatSendSchema,
  'chat:sync_request': ChatSyncRequestSchema,
  'game:join': GameJoinSchema,
  'game:roll': RollDiceSchema,
  'game:choose_move': ChooseMoveSchema,
  'game:sync_request': SyncRequestSchema,
  'game:ping': PingSchema,
}

export const validateCommand = (command: string, payload: unknown) => {
  const schema = schemas[command]
  if (!schema) {
    throw new Error(`Unknown command: ${command}`)
  }
  return schema.parse(payload)
}
