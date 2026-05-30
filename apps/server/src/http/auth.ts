import type { FastifyInstance } from 'fastify'
import { isRegisteredUser, requireAuthUser } from '../lib/auth'
import {
  mapDbProfileRow,
  mergePlayedSeconds,
  PROFILE_SELECT_COLUMNS,
  statsUpdateFromMergedSeconds,
  type ProfileRow,
} from '../lib/profile-db'
import { getAuthDisplayName, getSupabaseAdminClient } from '../lib/supabase-server'

type LinkResponse = {
  merged: boolean
  profile: ProfileRow & { display_name: string | null }
}

type DbProfile = Parameters<typeof mapDbProfileRow>[0]

export function registerAuthRoutes(fastify: FastifyInstance): void {
  fastify.post('/api/auth/link-anon', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
    if (!isRegisteredUser(user)) {
      return reply.status(403).send({ error: 'Only registered accounts can link guest progress' })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(500).send({ error: 'Supabase not configured' })
    }

    const body = (request.body ?? {}) as { anonId?: string }
    const anonId = body.anonId?.trim()
    if (!anonId) return reply.status(400).send({ error: 'anonId required' })

    if (anonId === user.id) {
      const existing = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('id', user.id)
        .single()
      if (existing.error || !existing.data) {
        return reply.status(404).send({ error: 'User profile not found' })
      }
      const row = mapDbProfileRow(existing.data)
      return reply.status(200).send({
        merged: false,
        profile: {
          ...row,
          display_name: await getAuthDisplayName(user.id),
        },
      })
    }

    const [anonProfile, userProfile] = await Promise.all([
      supabase.from('profiles').select(PROFILE_SELECT_COLUMNS).eq('id', anonId).single(),
      supabase.from('profiles').select(PROFILE_SELECT_COLUMNS).eq('id', user.id).single(),
    ])

    if (anonProfile.error || !anonProfile.data) {
      return reply.status(404).send({ error: 'Anon profile not found' })
    }
    if (userProfile.error || !userProfile.data) {
      return reply.status(404).send({ error: 'User profile not found' })
    }

    const anon = anonProfile.data as DbProfile
    const registered = userProfile.data as DbProfile

    const mergedStats = {
      total_games: (registered.total_games ?? 0) + (anon.total_games ?? 0),
      total_wins: (registered.total_wins ?? 0) + (anon.total_wins ?? 0),
      total_losses: (registered.total_losses ?? 0) + (anon.total_losses ?? 0),
      ...statsUpdateFromMergedSeconds(mergePlayedSeconds(registered, anon)),
    }

    const update = await supabase
      .from('profiles')
      .update(mergedStats)
      .eq('id', user.id)
      .select(PROFILE_SELECT_COLUMNS)
      .single()

    if (update.error || !update.data) {
      return reply.status(500).send({ error: update.error?.message ?? 'Merge failed' })
    }

    await supabase
      .from('game_history')
      .update({ user_id: user.id, anon_id: null })
      .eq('anon_id', anonId)
    await supabase.from('profiles').delete().eq('id', anonId)

    const row = mapDbProfileRow(update.data)
    const response: LinkResponse = {
      merged: true,
      profile: {
        ...row,
        display_name: await getAuthDisplayName(user.id),
      },
    }
    return response
  })
}
