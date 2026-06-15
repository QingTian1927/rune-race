import type { FastifyInstance } from 'fastify'
import { requireAuthUser } from '../lib/auth'
import { getSupabaseAdminClient } from '../lib/supabase-server'
import {
  getAccountNudgeEnabled,
  getPublicFeatureFlags,
  isAccountNudgeEnvDisabled,
  setAccountNudgeEnabled,
} from '../feature-flags/service'
import {
  getAdminSiteBanner,
  SiteBannerValidationError,
  updateSiteBanner,
  type SiteBannerPatch,
} from '../site-banner/service'

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
      const banner = await getAdminSiteBanner(supabase)
      return {
        ...flags,
        ...banner,
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

      const body = (request.body ?? {}) as {
        accountNudgeEnabled?: unknown
        siteBanner?: unknown
      }

      const hasNudge = typeof body.accountNudgeEnabled === 'boolean'
      const hasBanner = body.siteBanner !== null && typeof body.siteBanner === 'object'
      if (!hasNudge && !hasBanner) {
        return reply.status(400).send({
          error: 'Provide accountNudgeEnabled and/or siteBanner',
        })
      }

      let accountNudgeEnabled = await getAccountNudgeEnabled(supabase)
      if (hasNudge) {
        if (isAccountNudgeEnvDisabled() && body.accountNudgeEnabled) {
          return reply.status(409).send({
            error: 'ACCOUNT_NUDGE_ENABLED=false on server; cannot enable via admin until env is cleared',
          })
        }
        await setAccountNudgeEnabled(supabase, body.accountNudgeEnabled)
        accountNudgeEnabled = await getAccountNudgeEnabled(supabase)
      }

      let banner = await getAdminSiteBanner(supabase)
      if (hasBanner) {
        try {
          banner = await updateSiteBanner(supabase, body.siteBanner as SiteBannerPatch)
        } catch (err) {
          if (err instanceof SiteBannerValidationError) {
            return reply.status(400).send({ error: err.message })
          }
          throw err
        }
      }

      return {
        accountNudgeEnabled,
        accountNudgeEnvDisabled: isAccountNudgeEnvDisabled(),
        ...banner,
      }
    } catch (err) {
      request.log.error({ err }, 'admin_settings_patch_failed')
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to update admin settings',
      })
    }
  })
}
