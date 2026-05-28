import type { FastifyInstance } from 'fastify'
import { getSupabaseAdminClient } from '../lib/supabase-server'
import { requireAuthUser } from '../lib/auth'

type ProfileRow = {
  id: string
  display_name: string | null
  bio: string | null
  avatar_emoji: string | null
  phone: string | null
  xp: number
  coins: number
  items: unknown
  is_anon: boolean
}

type LinkResponse = {
  merged: boolean
  profile: ProfileRow
}

function normalizeItems(items: unknown): unknown[] {
  if (!Array.isArray(items)) return []
  return items
}

function itemKey(item: unknown): string {
  if (item && typeof item === 'object' && 'id' in item) {
    const idValue = (item as { id?: unknown }).id
    if (typeof idValue === 'string' || typeof idValue === 'number') {
      return `id:${idValue}`
    }
  }
  return `json:${JSON.stringify(item)}`
}

function mergeItems(primary: unknown, secondary: unknown): unknown[] {
  const merged = new Map<string, unknown>()
  for (const item of normalizeItems(primary)) {
    merged.set(itemKey(item), item)
  }
  for (const item of normalizeItems(secondary)) {
    const key = itemKey(item)
    if (!merged.has(key)) merged.set(key, item)
  }
  return Array.from(merged.values())
}

export function registerAuthRoutes(fastify: FastifyInstance): void {
  fastify.post('/api/auth/link-anon', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
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
        .select('id, display_name, phone, xp, coins, items, is_anon')
        .eq('id', user.id)
        .single()
      if (existing.error || !existing.data) {
        return reply.status(404).send({ error: 'User profile not found' })
      }
      return reply.status(200).send({ merged: false, profile: existing.data })
    }

    const [anonProfile, userProfile] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, bio, avatar_emoji, phone, xp, coins, items, is_anon')
        .eq('id', anonId)
        .single(),
      supabase
        .from('profiles')
        .select('id, display_name, bio, avatar_emoji, phone, xp, coins, items, is_anon')
        .eq('id', user.id)
        .single(),
    ])

    if (anonProfile.error || !anonProfile.data) {
      return reply.status(404).send({ error: 'Anon profile not found' })
    }

    if (userProfile.error || !userProfile.data) {
      return reply.status(404).send({ error: 'User profile not found' })
    }

    const merged: ProfileRow = {
      ...userProfile.data,
      display_name: userProfile.data.display_name ?? anonProfile.data.display_name,
      bio: userProfile.data.bio ?? anonProfile.data.bio,
      avatar_emoji: userProfile.data.avatar_emoji ?? anonProfile.data.avatar_emoji,
      phone: userProfile.data.phone ?? anonProfile.data.phone,
      xp: (userProfile.data.xp ?? 0) + (anonProfile.data.xp ?? 0),
      coins: (userProfile.data.coins ?? 0) + (anonProfile.data.coins ?? 0),
      items: mergeItems(userProfile.data.items, anonProfile.data.items),
      is_anon: false,
    }

    const update = await supabase
      .from('profiles')
      .update({
        display_name: merged.display_name,
        bio: merged.bio,
        avatar_emoji: merged.avatar_emoji,
        phone: merged.phone,
        xp: merged.xp,
        coins: merged.coins,
        items: merged.items,
        is_anon: false,
      })
      .eq('id', user.id)
      .select('id, display_name, bio, avatar_emoji, phone, xp, coins, items, is_anon')
      .single()

    if (update.error || !update.data) {
      return reply.status(500).send({ error: update.error?.message ?? 'Merge failed' })
    }

    await supabase.from('game_history').update({ user_id: user.id }).eq('anon_id', anonId)
    await supabase.from('profiles').delete().eq('id', anonId)

    const response: LinkResponse = { merged: true, profile: update.data }
    return response
  })
}
