import type { FastifyInstance } from 'fastify'
import type { Server as SocketIOServer } from 'socket.io'
import {
  buildReadinessReport,
  readinessHttpStatus,
  type ReadinessProbeContext,
} from '../health/readiness'
import type { AnalyticsService } from '../analytics/service'
import type { GameStore } from '../game/game-store'
import type { LobbyStore } from '../lobby/lobby-store'
import type { MatchmakingQueue } from './matchmaking'

export type HealthRouteDeps = {
  io: SocketIOServer
  lobbyStore: LobbyStore
  gameStore: GameStore
  matchmaking: MatchmakingQueue
  analyticsService: AnalyticsService
  corsRestricted: boolean
  startedAtMs: number
}

export function registerHealthRoutes(fastify: FastifyInstance, deps: HealthRouteDeps): void {
  const context: ReadinessProbeContext = {
    httpServer: fastify.server,
    io: deps.io,
    getActiveLobbyCount: () => deps.lobbyStore.getActiveLobbyCount(),
    getActiveGameCount: () => deps.gameStore.getActiveGameCount(),
    getMatchmakingQueueSize: () => deps.matchmaking.getQueueSize(),
    isAnalyticsSchedulerActive: () => deps.analyticsService.isSchedulerActive(),
    corsRestricted: deps.corsRestricted,
    startedAtMs: deps.startedAtMs,
  }

  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    readiness: '/ready',
  }))

  fastify.get('/ready', async (request, reply) => {
    const query = request.query as { detail?: string }
    const detail = query.detail === 'admin' ? 'admin' : 'public'
    const report = await buildReadinessReport(context, { detail })
    return reply.status(readinessHttpStatus(report.status)).send(report)
  })
}
