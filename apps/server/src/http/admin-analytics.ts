import type { FastifyInstance } from 'fastify'
import { requireAuthUser } from '../lib/auth'
import { getSupabaseAdminClient } from '../lib/supabase-server'
import type { AnalyticsService } from '../analytics/service'

function isAdminUser(userId: string): boolean {
  const allowlist = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return allowlist.includes(userId)
}

export function registerAdminAnalyticsRoutes(
  fastify: FastifyInstance,
  analyticsService: AnalyticsService,
): void {
  fastify.get('/api/admin/analytics/live', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
    if (!isAdminUser(user.id)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
    return analyticsService.getLiveSnapshot()
  })

  fastify.get('/api/admin/analytics/timeseries', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
    if (!isAdminUser(user.id)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    const { from, to } = request.query as { from?: string; to?: string }
    const start = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000)
    const end = to ? new Date(to) : new Date()
    const { data, error } = await supabase
      .from('player_metrics_hourly')
      .select('bucket_start,unique_players,games_started,games_finished,total_play_seconds')
      .gte('bucket_start', start.toISOString())
      .lte('bucket_start', end.toISOString())
      .order('bucket_start', { ascending: true })

    if (error) {
      return reply.status(500).send({ error: error.message })
    }
    return { points: data ?? [] }
  })

  fastify.get('/api/admin/analytics/top-players', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
    if (!isAdminUser(user.id)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    const { metric } = request.query as { metric?: 'playtime' | 'games' }
    const orderColumn = metric === 'games' ? 'total_games' : 'total_played_seconds'
    const { data, error } = await supabase
      .from('profiles')
      .select('id,total_played_seconds,total_games,total_wins,total_losses,last_played_at')
      .eq('is_anon', false)
      .order(orderColumn, { ascending: false })
      .limit(10)

    if (error) {
      return reply.status(500).send({ error: error.message })
    }
    return { players: data ?? [] }
  })
}
