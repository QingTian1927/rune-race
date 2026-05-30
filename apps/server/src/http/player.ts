import type { FastifyInstance } from 'fastify'
import { requireAuthUser } from '../lib/auth'
import { setAuthDisplayName } from '../lib/supabase-server'

export function registerPlayerRoutes(fastify: FastifyInstance): void {
  fastify.patch('/api/player/display-name', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return

    const body = (request.body ?? {}) as { displayName?: string }
    if (typeof body.displayName !== 'string') {
      return reply.status(400).send({ error: 'displayName required' })
    }

    const name = body.displayName.trim()
    if (!name) {
      return reply.status(400).send({ error: 'displayName cannot be empty' })
    }
    if (name.length > 50) {
      return reply.status(400).send({ error: 'displayName too long' })
    }

    try {
      await setAuthDisplayName(user.id, name)
      return { display_name: name }
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to update display name',
      })
    }
  })
}
