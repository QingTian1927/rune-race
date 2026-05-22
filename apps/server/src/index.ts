import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { Server as SocketIOServer } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@rune-race/shared'
import { LobbyStore } from './lobby/lobby-store'
import { GameStore } from './game/game-store'
import { setupSocketHandlers } from './socket/handlers'
import { registerRoomRoutes } from './http/rooms'
import { MatchmakingQueue, registerMatchmakingRoutes } from './http/matchmaking'

const fastify = Fastify({ logger: true })
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
  cors: { origin: '*' },
})

const lobbyStore = new LobbyStore()
const gameStore = new GameStore()

setupSocketHandlers(io, lobbyStore, gameStore)

const matchmaking = new MatchmakingQueue(lobbyStore)

registerRoomRoutes(fastify, lobbyStore)
registerMatchmakingRoutes(fastify, matchmaking)

fastify.get('/', async () => ({
  message: 'Rune Race Server',
  status: 'running',
}))

fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))

/** @deprecated Use POST /api/rooms */
fastify.post('/dev/create-room', async (request) => {
  const body = (request.body ?? {}) as { playerId?: string; playerName?: string }
  const snapshot = lobbyStore.createLobby({
    hostPlayerId: body.playerId ?? `anon-${randomUUID()}`,
    hostName: body.playerName ?? 'Host',
  })
  return { roomId: snapshot.lobbyId, lobbyId: snapshot.lobbyId, joinCode: snapshot.joinCode }
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('Server running on http://localhost:3000')
    console.log('Socket.IO: ws://localhost:3000')
    console.log('API: GET/POST /api/rooms, POST /api/matchmaking/join')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
