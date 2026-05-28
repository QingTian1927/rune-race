import { useEffect, useMemo, useState } from 'react'
import { fetchProfileById } from '../lib/api'
import { isLegacyLocalAnonId } from '../lib/playerSession'

/**
 * Loads public profile avatars for a set of player ids (e.g. game participants).
 */
export function usePlayerAvatars(playerIds: string[]): Record<string, string> {
  const [avatars, setAvatars] = useState<Record<string, string>>({})

  const idsKey = useMemo(() => {
    const unique = [...new Set(playerIds.filter((id) => id && !isLegacyLocalAnonId(id)))]
    unique.sort()
    return unique.join('|')
  }, [playerIds])

  useEffect(() => {
    const ids = idsKey ? idsKey.split('|') : []
    if (!ids.length) {
      setAvatars({})
      return
    }

    let cancelled = false

    void Promise.all(
      ids.map(async (id) => {
        try {
          const profile = await fetchProfileById(id)
          return [id, profile.avatar_emoji?.trim() || ''] as const
        } catch {
          return [id, ''] as const
        }
      }),
    ).then((rows) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [id, emoji] of rows) {
        if (emoji) next[id] = emoji
      }
      setAvatars(next)
    })

    return () => {
      cancelled = true
    }
  }, [idsKey])

  return avatars
}
