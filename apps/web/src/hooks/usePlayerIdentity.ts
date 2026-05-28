import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { usePlayerProfile } from './usePlayerProfile'
import { getOrCreatePlayerId, getPlayerName } from '../lib/playerSession'

export type PlayerIdentity = {
  playerId: string
  playerName: string
  accessToken: string | null
  avatarEmoji: string | null
}

export function usePlayerIdentity(): PlayerIdentity {
  const { user, accessToken } = useAuth()
  const { profile } = usePlayerProfile()

  return useMemo(() => {
    const playerId = user?.id ?? getOrCreatePlayerId()
    const fromProfile = profile?.display_name?.trim()
    const fromMeta = (user?.user_metadata?.display_name as string | undefined)?.trim()
    const playerName = fromProfile || fromMeta || getPlayerName()
    const avatarEmoji = profile?.avatar_emoji ?? null

    return { playerId, playerName, accessToken, avatarEmoji }
  }, [accessToken, profile, user])
}

/** Profile view URL — only Supabase user ids exist in `profiles`. */
export function useMyProfilePath(): string {
  const { user } = useAuth()
  if (user?.id) return `/profile/${user.id}`
  return '/profile/edit'
}
