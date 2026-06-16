import { DEFAULT_HOUSE_ID, isHouseSkinId, isBotPlayerId, type HouseSkinId } from '@rune-race/shared'
import { useEffect, useMemo, useState } from 'react'
import { fetchPlayerCosmetics } from '../lib/api'

/**
 * Loads equipped house skins for players in a game.
 * Bots always use the default house.
 */
export function usePlayerHouseSkins(
  playerIds: string[],
  localHouse?: { playerId: string; houseId: HouseSkinId } | null,
): Record<string, HouseSkinId> {
  const [fetchedSkins, setFetchedSkins] = useState<Record<string, HouseSkinId>>({})

  const idsKey = useMemo(() => {
    const unique = [...new Set(playerIds.filter(Boolean))]
    unique.sort()
    return unique.join('|')
  }, [playerIds])

  const botSkins = useMemo(() => {
    const next: Record<string, HouseSkinId> = {}
    for (const id of playerIds) {
      if (isBotPlayerId(id)) {
        next[id] = DEFAULT_HOUSE_ID
      }
    }
    return next
  }, [playerIds])

  useEffect(() => {
    const ids = idsKey ? idsKey.split('|').filter((id) => !isBotPlayerId(id)) : []
    if (!ids.length) {
      setFetchedSkins({})
      return
    }

    let cancelled = false

    void Promise.all(
      ids.map(async (id) => {
        try {
          const cosmetics = await fetchPlayerCosmetics(id)
          const equipped = cosmetics.equippedHouseId
          return [id, isHouseSkinId(equipped) ? equipped : DEFAULT_HOUSE_ID] as const
        } catch {
          return [id, DEFAULT_HOUSE_ID] as const
        }
      }),
    ).then((rows) => {
      if (cancelled) return
      const next: Record<string, HouseSkinId> = {}
      for (const [id, houseId] of rows) {
        next[id] = houseId
      }
      setFetchedSkins(next)
    })

    return () => {
      cancelled = true
    }
  }, [idsKey])

  return useMemo(() => {
    const next: Record<string, HouseSkinId> = { ...botSkins, ...fetchedSkins }
    if (localHouse?.playerId && isHouseSkinId(localHouse.houseId)) {
      next[localHouse.playerId] = localHouse.houseId
    }
    return next
  }, [botSkins, fetchedSkins, localHouse?.houseId, localHouse?.playerId])
}
