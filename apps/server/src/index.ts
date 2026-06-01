import './load-env.js'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server as SocketIOServer } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@rune-race/shared'
import { ChatStore } from './chat/chat-store'
import { LobbyStore } from './lobby/lobby-store'
import { GameStore } from './game/game-store'
import { setupSocketHandlers } from './socket/handlers'
import { registerRoomRoutes } from './http/rooms'
import { MatchmakingQueue, registerMatchmakingRoutes } from './http/matchmaking'
import { registerProfileRoutes } from './http/profile'
import { registerPlayerRoutes } from './http/player'
import { registerAuthRoutes } from './http/auth'
import { getSupabaseAdminClient } from './lib/supabase-server'
import { AnalyticsService } from './analytics/service'
import { registerAdminAnalyticsRoutes } from './http/admin-analytics'
import { registerFeatureFlagRoutes } from './http/feature-flags'
import { registerAdminSettingsRoutes } from './http/admin-settings'

const port = Number(process.env.PORT) || 3000
const corsOrigins = process.env.CLIENT_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean)

const fastify = Fastify({ logger: true })
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
  cors: { origin: corsOrigins?.length ? corsOrigins : '*' },
})

const lobbyStore = new LobbyStore()
const gameStore = new GameStore()
const chatStore = new ChatStore()
const analyticsService = new AnalyticsService({
  supabase: getSupabaseAdminClient(),
  logger: { error: (msg, err) => fastify.log.error({ err }, msg) },
})
analyticsService.start()
void analyticsService.syncCounters(lobbyStore.getActiveLobbyCount(), gameStore.getActiveGameCount())

const matchmaking = new MatchmakingQueue(lobbyStore)

setupSocketHandlers(io, lobbyStore, gameStore, chatStore, analyticsService, matchmaking)

lobbyStore.startCleanupTimer()

registerRoomRoutes(fastify, lobbyStore)
registerMatchmakingRoutes(fastify, matchmaking)
registerProfileRoutes(fastify)
registerPlayerRoutes(fastify)
registerAuthRoutes(fastify)
registerAdminAnalyticsRoutes(fastify, analyticsService)
registerFeatureFlagRoutes(fastify)
registerAdminSettingsRoutes(fastify)

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

const shutdown = async (signal: string) => {
  fastify.log.info({ signal }, 'Shutting down')
  analyticsService.stop()
  matchmaking.shutdown()
  lobbyStore.stopCleanupTimer()
  try {
    await fastify.close()
  } catch (err) {
    fastify.log.error(err)
  }
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

const start = async () => {
  try {
    await fastify.register(cors, {
      origin: corsOrigins?.length ? corsOrigins : true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`Server running on port ${port}`)
    console.log('Socket.IO attached to same host')
    console.log('API: GET/POST /api/rooms, POST /api/matchmaking/join')
    console.log('Admin API: GET /api/admin/analytics/*')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
