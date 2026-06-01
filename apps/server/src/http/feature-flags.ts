import type { FastifyInstance } from 'fastify'
import { getPublicFeatureFlags } from '../feature-flags/service'
import { getSupabaseAdminClient } from '../lib/supabase-server'

export function registerFeatureFlagRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/public/feature-flags', async (request, reply) => {
    try {
      return await getPublicFeatureFlags(getSupabaseAdminClient())
    } catch (err) {
      request.log.error({ err }, 'feature_flags_get_failed')
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to load feature flags',
      })
    }
  })
}
