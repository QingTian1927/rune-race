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
  total_played_hours: number
  total_games: number
  total_wins: number
  total_losses: number
}

const MAX_BIO_LENGTH = 240
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

export function registerProfileRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/profile', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(500).send({ error: 'Supabase not configured' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, display_name, bio, avatar_emoji, phone, xp, coins, items, is_anon, total_played_hours, total_games, total_wins, total_losses',
      )
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return reply.status(500).send({ error: error.message })
    }

    if (!data) {
      const insert = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          display_name: (user.user_metadata?.display_name as string | undefined) ?? null,
          phone: (user.user_metadata?.phone as string | undefined) ?? null,
          is_anon: !!user.user_metadata?.is_anon,
        })
        .select(
          'id, display_name, bio, avatar_emoji, phone, xp, coins, items, is_anon, total_played_hours, total_games, total_wins, total_losses',
        )
        .single()

      if (insert.error || !insert.data) {
        return reply.status(500).send({ error: insert.error?.message ?? 'Profile create failed' })
      }

      return insert.data as ProfileRow
    }

    return data as ProfileRow
  })

  fastify.get('/api/profile/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(500).send({ error: 'Supabase not configured' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, display_name, bio, avatar_emoji, phone, xp, coins, items, is_anon, total_played_hours, total_games, total_wins, total_losses',
      )
      .eq('id', id)
      .single()

    if (error || !data) {
      return reply.status(404).send({ error: 'Profile not found' })
    }

    return data as ProfileRow
  })

  fastify.patch('/api/profile', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(500).send({ error: 'Supabase not configured' })
    }

    const body = (request.body ?? {}) as {
      displayName?: string
      bio?: string
      avatarEmoji?: string
      phone?: string
    }
    const patch: {
      display_name?: string | null
      bio?: string | null
      avatar_emoji?: string | null
      phone?: string
    } = {}
    if (typeof body.displayName === 'string') {
      const name = body.displayName.trim()
      patch.display_name = name || null
    }
    if (typeof body.bio === 'string') {
      const bio = body.bio.trim()
      if (bio.length > MAX_BIO_LENGTH) {
        return reply.status(400).send({ error: 'Bio too long' })
      }
      patch.bio = bio
    }
    if (typeof body.avatarEmoji === 'string') {
      const avatar = body.avatarEmoji.trim()
      if (avatar && !ALLOWED_AVATARS.has(avatar)) {
        return reply.status(400).send({ error: 'Invalid avatar' })
      }
      patch.avatar_emoji = avatar || null
    }
    if (typeof body.phone === 'string') patch.phone = body.phone.trim()

    if (!Object.keys(patch).length) {
      return reply.status(400).send({ error: 'No changes' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select(
        'id, display_name, bio, avatar_emoji, phone, xp, coins, items, is_anon, total_played_hours, total_games, total_wins, total_losses',
      )
      .single()

    if (error || !data) {
      return reply.status(500).send({ error: error?.message ?? 'Profile update failed' })
    }

    return data as ProfileRow
  })
}
