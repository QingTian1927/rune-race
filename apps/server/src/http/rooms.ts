import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { LobbyStore } from '../lobby/lobby-store'
import { getAuthUser } from '../lib/auth'

export function registerRoomRoutes(fastify: FastifyInstance, lobbyStore: LobbyStore): void {
  fastify.get('/api/rooms', async () => {
    const lobbies = lobbyStore.listPublicLobbies()
    return {
      rooms: lobbies.map((l) => ({
        lobbyId: l.lobbyId,
        joinCode: l.joinCode,
        name: l.settings.name,
        playerCount: l.playerCount,
        maxPlayers: l.settings.maxPlayers,
        hasPassword: l.settings.hasPassword,
        status: l.status,
      })),
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
    return {
      lobbyId: snapshot.lobbyId,
      joinCode: snapshot.joinCode,
      name: snapshot.settings.name,
      playerCount: snapshot.playerCount,
      maxPlayers: snapshot.settings.maxPlayers,
      hasPassword: snapshot.settings.hasPassword,
      status: snapshot.status,
    }
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
      (user?.user_metadata?.display_name as string | undefined) ??
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
