import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { LobbyPlayer, LobbySnapshot } from '@rune-race/shared'
import type { LobbyStore } from '../lobby/lobby-store'
import { displayNameFromMetadata } from '@rune-race/shared'
import { getAuthUser } from '../lib/auth'

function countLobbySeats(players: LobbyPlayer[]) {
  const botCount = players.filter((p) => p.isBot).length
  const humanPlayerCount = players.filter((p) => !p.isBot).length
  return { humanPlayerCount, botCount, playerCount: humanPlayerCount }
}

function toPublicRoomEntry(snapshot: LobbySnapshot) {
  const counts = countLobbySeats(snapshot.players)
  return {
    lobbyId: snapshot.lobbyId,
    joinCode: snapshot.joinCode,
    name: snapshot.settings.name,
    ...counts,
    maxPlayers: snapshot.settings.maxPlayers,
    hasPassword: snapshot.settings.hasPassword,
    status: snapshot.status,
  }
}

export function registerRoomRoutes(fastify: FastifyInstance, lobbyStore: LobbyStore): void {
  fastify.get('/api/rooms', async () => {
    const lobbies = lobbyStore.listPublicLobbies()
    return {
      rooms: lobbies.map((l) => toPublicRoomEntry(l)),
    }
  })

  fastify.get('/api/rooms/by-code/:joinCode', async (request, reply) => {
    const { joinCode } = request.params as { joinCode: string }
    const lobbyId = lobbyStore.resolveLobbyId(undefined, joinCode)
    if (!lobbyId) {
      return reply.status(404).send({ error: 'Room not found' })
    }
    const snapshot = lobbyStore.getSnapshot(lobbyId)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Room not found' })
    }
    return toPublicRoomEntry(snapshot)
  })

  fastify.get('/api/rooms/:lobbyId', async (request, reply) => {
    const { lobbyId } = request.params as { lobbyId: string }
    const snapshot = lobbyStore.getSnapshot(lobbyId)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Room not found' })
    }
    return toPublicRoomEntry(snapshot)
  })

  fastify.post('/api/rooms', async (request) => {
    const body = request.body as {
      playerId?: string
      playerName?: string
      name?: string
      password?: string
      visibility?: 'public' | 'private'
    }

    const user = await getAuthUser(request)

    const playerId = user?.id ?? body.playerId ?? `anon-${randomUUID()}`
    const playerName =
      body.playerName ??
      displayNameFromMetadata(user?.user_metadata as Record<string, unknown>) ??
      'Player'
    const snapshot = lobbyStore.createLobby({
      hostPlayerId: playerId,
      hostName: playerName,
      name: body.name,
      password: body.password,
      visibility: body.visibility ?? 'public',
    })

    return {
      lobbyId: snapshot.lobbyId,
      joinCode: snapshot.joinCode,
      playerId,
    }
  })
}
