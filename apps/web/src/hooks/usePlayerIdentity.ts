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
  /** False while auth is loading or playerId is not yet tied to the session token. */
  identityReady: boolean
}

export function usePlayerIdentity(): PlayerIdentity {
  const { user, accessToken, loading: authLoading, isRegistered } = useAuth()
  const { profile } = usePlayerProfile()

  const playerId = user?.id ?? (authLoading ? '' : getOrCreatePlayerId())
  const playerName = user ? getDisplayName(user) : getPlayerName()
  const avatarEmoji = isRegistered ? (profile?.avatar_emoji ?? null) : null
  const isAnon = isAnonUser(user)
  const identityReady =
    !authLoading &&
    Boolean(playerId) &&
    (!accessToken || Boolean(user?.id && user.id === playerId))

  return {
    playerId,
    playerName,
    accessToken,
    avatarEmoji,
    isRegistered,
    isAnon,
    /** Any non-registered visitor may edit the home name field; Supabase sync applies to anon sessions. */
    canEditNameOnHome: !isRegistered,
    identityReady,
  }
}

export function useMyProfilePath(): string | null {
  const { user, isRegistered } = useAuth()
  if (isRegistered && user?.id) return `/profile/${user.id}`
  return null
}
