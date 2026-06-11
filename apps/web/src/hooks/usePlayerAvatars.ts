import { BOT_AVATAR_SENTINEL, isBotPlayerId } from '@rune-race/shared'
import { useEffect, useMemo, useState } from 'react'
import { fetchProfileById } from '../lib/api'

/**
 * Loads public profile avatars for registered players in a game.
 * Bot players use a local robot icon and never hit the profile API.
 */
export function usePlayerAvatars(
  playerIds: string[],
  localAvatar?: { playerId: string; emoji: string | null },
): Record<string, string> {
  const [fetchedAvatars, setFetchedAvatars] = useState<Record<string, string>>({})

  const idsKey = useMemo(() => {
    const unique = [...new Set(playerIds.filter(Boolean))]
    unique.sort()
    return unique.join('|')
  }, [playerIds])

  const botAvatars = useMemo(() => {
    const next: Record<string, string> = {}
    for (const id of playerIds) {
      if (isBotPlayerId(id)) {
        next[id] = BOT_AVATAR_SENTINEL
      }
    }
    return next
  }, [playerIds])

  useEffect(() => {
    const ids = idsKey ? idsKey.split('|').filter((id) => !isBotPlayerId(id)) : []
    if (!ids.length) {
      setFetchedAvatars({})
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
      setFetchedAvatars(next)
    })

    return () => {
      cancelled = true
    }
  }, [idsKey])

  return useMemo(() => {
    const next = { ...botAvatars, ...fetchedAvatars }
    if (localAvatar?.playerId && localAvatar.emoji?.trim()) {
      next[localAvatar.playerId] = localAvatar.emoji.trim()
    }
    return next
  }, [botAvatars, fetchedAvatars, localAvatar?.emoji, localAvatar?.playerId])
}
