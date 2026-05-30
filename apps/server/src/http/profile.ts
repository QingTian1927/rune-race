import type { FastifyInstance } from 'fastify'
import type { User } from '@supabase/supabase-js'
import { isRegisteredAccount } from '@rune-race/shared'
import { isRegisteredUser, requireAuthUser } from '../lib/auth'
import {
  legacyDisplayNameFromRow,
  mapDbProfileRow,
  PROFILE_SELECT_COLUMNS,
  type ProfileRow,
} from '../lib/profile-db'
import { getAuthDisplayName, getSupabaseAdminClient, setAuthDisplayName } from '../lib/supabase-server'

export type { ProfileRow } from '../lib/profile-db'

export type ProfileResponse = ProfileRow & {
  display_name: string | null
}

export type PublicProfileResponse = Omit<ProfileRow, 'is_anon' | 'phone'> & {
  display_name: string | null
}

const MAX_BIO_LENGTH = 200
const ALLOWED_AVATARS = new Set([
  '🍎',
  '🍊',
  '🍋',
  '🍇',
  '🍉',
  '🍓',
  '🍒',
  '🥭',
  '🍍',
  '🥝',
  '🫐',
  '🥥',
])

async function resolveDisplayName(
  userId: string,
  row?: { display_name?: string | null },
): Promise<string | null> {
  const fromAuth = await getAuthDisplayName(userId)
  if (fromAuth) return fromAuth
  if (row) return legacyDisplayNameFromRow(row as Parameters<typeof legacyDisplayNameFromRow>[0])
  return null
}

async function toProfileResponse(
  row: ProfileRow,
  legacyRow?: { display_name?: string | null },
): Promise<ProfileResponse> {
  const display_name = await resolveDisplayName(row.id, legacyRow)
  return { ...row, display_name }
}

async function ensureRegisteredProfileRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  user: User,
): Promise<{ row: ProfileRow | null; error: string | null; status: number }> {
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id)
  if (authError || !authUser.user) {
    return { row: null, error: 'Session expired — please sign in again', status: 401 }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_COLUMNS)
    .eq('id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { row: null, error: error.message, status: 500 }
  }

  if (data) {
    const row = mapDbProfileRow(data)
    if (!isRegisteredAccount(row.is_anon)) {
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ is_anon: false })
        .eq('id', user.id)
        .select(PROFILE_SELECT_COLUMNS)
        .single()
      if (updateError || !updated) {
        return { row: null, error: updateError?.message ?? 'Profile update failed', status: 500 }
      }
      return { row: mapDbProfileRow(updated), error: null, status: 200 }
    }
    return { row, error: null, status: 200 }
  }

  const insert = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      phone: (user.user_metadata?.phone as string | undefined) ?? null,
      is_anon: false,
    })
    .select(PROFILE_SELECT_COLUMNS)
    .single()

  if (insert.error || !insert.data) {
    const message = insert.error?.message ?? 'Profile create failed'
    if (insert.error?.code === '23503') {
      return { row: null, error: 'Session expired — please sign in again', status: 401 }
    }
    return { row: null, error: message, status: 500 }
  }

  return { row: mapDbProfileRow(insert.data), error: null, status: 200 }
}

export function registerProfileRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/profile', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
    if (!isRegisteredUser(user)) {
      return reply.status(403).send({ error: 'Profile requires a registered account' })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    const ensured = await ensureRegisteredProfileRow(supabase, user)
    if (!ensured.row) {
      return reply.status(ensured.status).send({ error: ensured.error ?? 'Profile not found' })
    }

    return toProfileResponse(ensured.row)
  })

  fastify.get('/api/profile/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_COLUMNS)
      .eq('id', id)
      .single()

    if (error || !data) {
      return reply.status(404).send({ error: 'Profile not found' })
    }

    const row = mapDbProfileRow(data)
    if (!isRegisteredAccount(row.is_anon)) {
      return reply.status(404).send({ error: 'Profile not found' })
    }

    let display_name = await getAuthDisplayName(id)
    if (!display_name) {
      const legacy = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle()
      if (!legacy.error && legacy.data) {
        display_name = legacyDisplayNameFromRow(legacy.data as Parameters<typeof legacyDisplayNameFromRow>[0])
      }
    }
    const { phone: _phone, is_anon: _isAnon, ...publicRow } = row
    const response: PublicProfileResponse = { ...publicRow, display_name }
    return response
  })

  fastify.patch('/api/profile', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
    if (!isRegisteredUser(user)) {
      return reply.status(403).send({ error: 'Profile requires a registered account' })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    const body = (request.body ?? {}) as {
      bio?: string
      avatarEmoji?: string
      phone?: string
      displayName?: string
    }

    if (
      typeof body.displayName !== 'string' &&
      typeof body.bio !== 'string' &&
      typeof body.avatarEmoji !== 'string' &&
      typeof body.phone !== 'string'
    ) {
      return reply.status(400).send({ error: 'No changes' })
    }

    if (typeof body.displayName === 'string') {
      try {
        await setAuthDisplayName(user.id, body.displayName)
      } catch (err) {
        return reply.status(500).send({
          error: err instanceof Error ? err.message : 'Failed to update display name',
        })
      }
    }

    const patch: { bio?: string | null; avatar_emoji?: string | null; phone?: string | null } = {}
    if (typeof body.bio === 'string') {
      const bio = body.bio.trim()
      if (bio.length > MAX_BIO_LENGTH) {
        return reply.status(400).send({ error: 'Bio too long' })
      }
      patch.bio = bio || null
    }
    if (typeof body.avatarEmoji === 'string') {
      const avatar = body.avatarEmoji.trim()
      if (avatar && !ALLOWED_AVATARS.has(avatar)) {
        return reply.status(400).send({ error: 'Invalid avatar' })
      }
      patch.avatar_emoji = avatar || null
    }
    if (typeof body.phone === 'string') {
      patch.phone = body.phone.trim() || null
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .eq('is_anon', false)

      if (error) {
        return reply.status(500).send({ error: error.message })
      }
    }

    const { data, error: loadError } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_COLUMNS)
      .eq('id', user.id)
      .single()

    if (loadError || !data) {
      return reply.status(500).send({ error: loadError?.message ?? 'Profile load failed' })
    }

    return toProfileResponse(mapDbProfileRow(data))
  })
}
