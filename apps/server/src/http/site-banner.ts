import type { FastifyInstance } from 'fastify'
import { getPublicSiteBanner } from '../site-banner/service'
import { getSupabaseAdminClient } from '../lib/supabase-server'

export function registerSiteBannerRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/public/site-banner', async (request, reply) => {
    try {
      return await getPublicSiteBanner(getSupabaseAdminClient())
    } catch (err) {
      request.log.error({ err }, 'site_banner_get_failed')
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to load site banner',
      })
    }
  })
}
