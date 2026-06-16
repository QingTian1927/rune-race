import type { FastifyInstance } from 'fastify'
import type { User } from '@supabase/supabase-js'
import {
  DEFAULT_HOUSE_ID,
  HOUSE_CATALOG,
  isHouseOwnedByDefault,
  isHouseSkinId,
  listShopHouseSkins,
} from '@rune-race/shared'
import { isRegisteredUser, requireAuthUser } from '../lib/auth'
import { ensureProfileRow, ensureProfileRowAndSelect } from '../lib/ensure-profile'
import { mapDbProfileRow, PROFILE_SELECT_COLUMNS, type ProfileRow } from '../lib/profile-db'
import { getSupabaseAdminClient } from '../lib/supabase-server'

async function ensureAuthProfileRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  user: User,
): Promise<{ row: ProfileRow | null; error: string | null; status: number }> {
  if (isRegisteredUser(user)) {
    const row = await ensureProfileRowAndSelect(supabase, user.id)
    if (!row) {
      return { row: null, error: 'Profile not found', status: 404 }
    }
    return { row, error: null, status: 200 }
  }

  const row = await ensureProfileRowAndSelect(supabase, user.id)
  if (!row) {
    return { row: null, error: 'Profile not found', status: 404 }
  }
  return { row, error: null, status: 200 }
}

async function loadOwnedHouseIds(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  playerId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('player_cosmetics')
    .select('cosmetic_id')
    .eq('player_id', playerId)

  if (error) {
    throw new Error(error.message)
  }

  const owned = new Set<string>([DEFAULT_HOUSE_ID])
  for (const row of data ?? []) {
    if (typeof row.cosmetic_id === 'string' && isHouseSkinId(row.cosmetic_id)) {
      owned.add(row.cosmetic_id)
    }
  }
  return [...owned]
}

async function playerOwnsHouse(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  playerId: string,
  houseId: string,
): Promise<boolean> {
  if (isHouseOwnedByDefault(houseId as typeof DEFAULT_HOUSE_ID)) return true
  const { data, error } = await supabase
    .from('player_cosmetics')
    .select('cosmetic_id')
    .eq('player_id', playerId)
    .eq('cosmetic_id', houseId)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export function registerShopRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/shop/catalog', async () => ({
    houses: listShopHouseSkins(),
  }))

  fastify.get('/api/players/:id/cosmetics', async (request, reply) => {
    const { id } = request.params as { id: string }
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('equipped_house_id')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return reply.status(500).send({ error: error.message })
    }
    if (!data) {
      return { equippedHouseId: DEFAULT_HOUSE_ID }
    }

    const equipped =
      typeof data.equipped_house_id === 'string' && isHouseSkinId(data.equipped_house_id)
        ? data.equipped_house_id
        : DEFAULT_HOUSE_ID

    return { equippedHouseId: equipped }
  })

  fastify.get('/api/shop/inventory', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    const ensured = await ensureAuthProfileRow(supabase, user)
    if (!ensured.row) {
      return reply.status(ensured.status).send({ error: ensured.error ?? 'Profile not found' })
    }

    try {
      const ownedHouseIds = await loadOwnedHouseIds(supabase, user.id)
      const equippedHouseId = isHouseSkinId(ensured.row.equipped_house_id)
        ? ensured.row.equipped_house_id
        : DEFAULT_HOUSE_ID

      return {
        coins: ensured.row.coins,
        equippedHouseId,
        ownedHouseIds,
      }
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to load inventory',
      })
    }
  })

  fastify.post('/api/shop/purchase', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return

    const body = (request.body ?? {}) as { houseId?: string }
    const houseId = typeof body.houseId === 'string' ? body.houseId.trim() : ''
    if (!isHouseSkinId(houseId)) {
      return reply.status(400).send({ error: 'Invalid houseId' })
    }
    if (isHouseOwnedByDefault(houseId)) {
      return reply.status(400).send({ error: 'Default house is free and already owned' })
    }

    const catalog = HOUSE_CATALOG[houseId]
    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    await ensureProfileRow(supabase, user.id)

    if (await playerOwnsHouse(supabase, user.id, houseId)) {
      return reply.status(409).send({ error: 'Already owned' })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return reply.status(500).send({ error: profileError?.message ?? 'Profile read failed' })
    }

    const currentCoins = typeof profile.coins === 'number' ? profile.coins : 0
    if (currentCoins < catalog.price) {
      return reply.status(402).send({
        error: 'Insufficient coins',
        required: catalog.price,
        balance: currentCoins,
      })
    }

    const balanceAfter = currentCoins - catalog.price

    const { error: cosmeticError } = await supabase.from('player_cosmetics').insert({
      player_id: user.id,
      cosmetic_id: houseId,
    })

    if (cosmeticError) {
      if (cosmeticError.code === '23505') {
        return reply.status(409).send({ error: 'Already owned' })
      }
      return reply.status(500).send({ error: cosmeticError.message })
    }

    const { error: spendError } = await supabase.from('coin_spend_transactions').insert({
      player_id: user.id,
      reason: 'shop_purchase',
      cosmetic_id: houseId,
      amount: catalog.price,
      balance_after: balanceAfter,
    })

    if (spendError) {
      return reply.status(500).send({ error: spendError.message })
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ coins: balanceAfter })
      .eq('id', user.id)
      .select(PROFILE_SELECT_COLUMNS)
      .single()

    if (updateError || !updated) {
      return reply.status(500).send({ error: updateError?.message ?? 'Coin update failed' })
    }

    const ownedHouseIds = await loadOwnedHouseIds(supabase, user.id)
    const row = mapDbProfileRow(updated)

    return {
      coins: row.coins,
      equippedHouseId: isHouseSkinId(row.equipped_house_id)
        ? row.equipped_house_id
        : DEFAULT_HOUSE_ID,
      ownedHouseIds,
      purchasedHouseId: houseId,
    }
  })

  fastify.patch('/api/shop/equip', async (request, reply) => {
    const user = await requireAuthUser(request, reply)
    if (!user) return

    const body = (request.body ?? {}) as { houseId?: string }
    const houseId = typeof body.houseId === 'string' ? body.houseId.trim() : ''
    if (!isHouseSkinId(houseId)) {
      return reply.status(400).send({ error: 'Invalid houseId' })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return reply.status(503).send({ error: 'Supabase not configured on server' })
    }

    await ensureProfileRow(supabase, user.id)

    if (!(await playerOwnsHouse(supabase, user.id, houseId))) {
      return reply.status(403).send({ error: 'House not owned' })
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ equipped_house_id: houseId })
      .eq('id', user.id)
      .select(PROFILE_SELECT_COLUMNS)
      .single()

    if (updateError || !updated) {
      return reply.status(500).send({ error: updateError?.message ?? 'Equip failed' })
    }

    const row = mapDbProfileRow(updated)
    const ownedHouseIds = await loadOwnedHouseIds(supabase, user.id)

    return {
      coins: row.coins,
      equippedHouseId: houseId,
      ownedHouseIds,
    }
  })
}
