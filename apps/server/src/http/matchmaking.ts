import type { FastifyInstance } from 'fastify'
import {
  MATCHMAKING_TIER_2_SECONDS,
  MATCHMAKING_TIER_3_SECONDS,
  MATCHMAKING_TIER_4_SECONDS,
  MATCHMAKING_PRIORITIZE_WINDOW_SECONDS,
} from '@rune-race/shared'
import type { LobbyStore } from '../lobby/lobby-store'
import { displayNameFromMetadata } from '@rune-race/shared'
import { getAuthUser } from '../lib/auth'

interface QueueEntry {
  playerId: string
  playerName: string
  joinedAt: number
}

export class MatchmakingQueue {
  private queue: QueueEntry[] = []
  private interval: ReturnType<typeof setInterval> | null = null
  private matchedResults = new Map<string, { lobbyId: string; joinCode: string }>()

  constructor(private lobbyStore: LobbyStore) {
    this.interval = setInterval(() => this.tick(), 1000)
  }

  join(playerId: string, playerName: string): void {
    if (this.queue.some((e) => e.playerId === playerId)) return
    this.queue.push({ playerId, playerName, joinedAt: Date.now() })
  }

  leave(playerId: string): void {
    this.queue = this.queue.filter((e) => e.playerId !== playerId)
  }

  getStatus(playerId: string): {
    status: 'idle' | 'queued' | 'matched'
    waitedSeconds: number
    queueSize: number
    lobbyId?: string
    joinCode?: string
  } {
    const matched = this.matchedResults.get(playerId)
    if (matched) {
      return {
        status: 'matched',
        waitedSeconds: 0,
        queueSize: this.queue.length,
        lobbyId: matched.lobbyId,
        joinCode: matched.joinCode,
      }
    }

    const entry = this.queue.find((e) => e.playerId === playerId)
    if (!entry) {
      return { status: 'idle', waitedSeconds: 0, queueSize: this.queue.length }
    }
    return {
      status: 'queued',
      waitedSeconds: Math.floor((Date.now() - entry.joinedAt) / 1000),
      queueSize: this.queue.length,
    }
  }

  private tick(): void {
    if (this.queue.length < 2) return

    const now = Date.now()
    const oldestWait = Math.max(
      ...this.queue.map((e) => (now - e.joinedAt) / 1000),
    )

    let batchSize: number | null = null

    // Prioritize matching larger groups during the initial window.
    if (oldestWait < MATCHMAKING_PRIORITIZE_WINDOW_SECONDS) {
      if (this.queue.length >= 4) {
        batchSize = 4
      } else if (this.queue.length >= 3) {
        batchSize = 3
      } else if (this.queue.length >= 2 && oldestWait >= MATCHMAKING_TIER_2_SECONDS) {
        batchSize = 2
      }
    } else {
      // After the prioritize window, match as fast as possible using tier thresholds.
      if (this.queue.length >= 4 && oldestWait >= MATCHMAKING_TIER_4_SECONDS) {
        batchSize = 4
      } else if (this.queue.length >= 3 && oldestWait >= MATCHMAKING_TIER_3_SECONDS) {
        batchSize = 3
      } else if (this.queue.length >= 2 && oldestWait >= MATCHMAKING_TIER_2_SECONDS) {
        batchSize = 2
      }
    }

    if (!batchSize) return

    const batch = this.queue.splice(0, batchSize)
    const host = batch[0]
    const snapshot = this.lobbyStore.createLobby({
      hostPlayerId: host.playerId,
      hostName: host.playerName,
      visibility: 'public',
      name: `Match ${snapshotJoinSuffix()}`,
    })

    for (let i = 1; i < batch.length; i += 1) {
      this.lobbyStore.joinLobby({
        lobbyId: snapshot.lobbyId,
        playerId: batch[i].playerId,
        playerName: batch[i].playerName,
      })
    }

    for (const entry of batch) {
      this.matchedResults.set(entry.playerId, {
        lobbyId: snapshot.lobbyId,
        joinCode: snapshot.joinCode,
      })
    }
  }

  shutdown(): void {
    if (this.interval) clearInterval(this.interval)
  }
}

function snapshotJoinSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}

export function registerMatchmakingRoutes(
  fastify: FastifyInstance,
  queue: MatchmakingQueue,
): void {
  fastify.post('/api/matchmaking/join', async (request) => {
    const body = request.body as { playerId: string; playerName: string }
    const user = await getAuthUser(request)
    const playerId = user?.id ?? body.playerId
    const playerName =
      body.playerName ??
      displayNameFromMetadata(user?.user_metadata as Record<string, unknown>) ??
      'Player'

    if (!playerId || !playerName) {
      return { error: 'playerId and playerName required' }
    }
    queue.join(playerId, playerName)
    return queue.getStatus(playerId)
  })

  fastify.delete('/api/matchmaking/leave', async (request) => {
    const body = request.body as { playerId: string }
    const user = await getAuthUser(request)
    const playerId = user?.id ?? body?.playerId
    if (playerId) queue.leave(playerId)
    return { status: 'left' }
  })

  fastify.get('/api/matchmaking/status', async (request) => {
    const { playerId } = request.query as { playerId?: string }
    const user = await getAuthUser(request)
    const resolvedId = user?.id ?? playerId
    if (!resolvedId) return { error: 'playerId required' }
    return queue.getStatus(resolvedId)
  })
}
