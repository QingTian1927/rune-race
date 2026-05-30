import { getDisplayName, isAnonUser } from '../lib/authUser'
import { getOrCreatePlayerId, getPlayerName } from '../lib/playerSession'
import { useAuth } from './useAuth'
import { usePlayerProfile } from './usePlayerProfile'

export type PlayerIdentity = {
  playerId: string
  playerName: string
  accessToken: string | null
  avatarEmoji: string | null
  isRegistered: boolean
  isAnon: boolean
  canEditNameOnHome: boolean
}

export function usePlayerIdentity(): PlayerIdentity {
  const { user, accessToken, isRegistered } = useAuth()
  const { profile } = usePlayerProfile()

  const playerId = user?.id ?? getOrCreatePlayerId()
  const playerName = user ? getDisplayName(user) : getPlayerName()
  const avatarEmoji = isRegistered ? (profile?.avatar_emoji ?? null) : null
  const isAnon = isAnonUser(user)

  return {
    playerId,
    playerName,
    accessToken,
    avatarEmoji,
    isRegistered,
    isAnon,
    canEditNameOnHome: isAnon,
  }
}

export function useMyProfilePath(): string | null {
  const { user, isRegistered } = useAuth()
  if (isRegistered && user?.id) return `/profile/${user.id}`
  return null
}
