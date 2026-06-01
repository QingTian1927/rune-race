import type { FastifyInstance } from 'fastify'
import { requireAuthUser } from '../lib/auth'
import { getSupabaseAdminClient } from '../lib/supabase-server'
import {
  getAccountNudgeEnabled,
  getPublicFeatureFlags,
  isAccountNudgeEnvDisabled,
  setAccountNudgeEnabled,
} from '../feature-flags/service'

function isAdminUser(userId: string): boolean {
  const allowlist = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return allowlist.includes(userId)
}

export function registerAdminSettingsRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/admin/settings', async (request, reply) => {
    try {
      const user = await requireAuthUser(request, reply)
      if (!user) return
      if (!isAdminUser(user.id)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const supabase = getSupabaseAdminClient()
      if (!supabase) {
        return reply.status(503).send({ error: 'Supabase not configured on server' })
      }

      const flags = await getPublicFeatureFlags(supabase)
      return {
        ...flags,
        accountNudgeEnvDisabled: isAccountNudgeEnvDisabled(),
      }
    } catch (err) {
      request.log.error({ err }, 'admin_settings_get_failed')
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to load admin settings',
      })
    }
  })

  fastify.patch('/api/admin/settings', async (request, reply) => {
    try {
      const user = await requireAuthUser(request, reply)
      if (!user) return
      if (!isAdminUser(user.id)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const supabase = getSupabaseAdminClient()
      if (!supabase) {
        return reply.status(503).send({ error: 'Supabase not configured on server' })
      }

      const body = (request.body ?? {}) as { accountNudgeEnabled?: unknown }
      if (typeof body.accountNudgeEnabled !== 'boolean') {
        return reply.status(400).send({ error: 'accountNudgeEnabled must be a boolean' })
      }

      if (isAccountNudgeEnvDisabled() && body.accountNudgeEnabled) {
        return reply.status(409).send({
          error: 'ACCOUNT_NUDGE_ENABLED=false on server; cannot enable via admin until env is cleared',
        })
      }

      await setAccountNudgeEnabled(supabase, body.accountNudgeEnabled)
      const accountNudgeEnabled = await getAccountNudgeEnabled(supabase)
      return {
        accountNudgeEnabled,
        accountNudgeEnvDisabled: isAccountNudgeEnvDisabled(),
      }
    } catch (err) {
      request.log.error({ err }, 'admin_settings_patch_failed')
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to update admin settings',
      })
    }
  })
}
