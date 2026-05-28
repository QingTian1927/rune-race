import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { getOrCreatePlayerId, getPlayerName } from '../lib/playerSession'

type PlayerIdentity = {
  playerId: string
  playerName: string
  accessToken: string | null
}

export function usePlayerIdentity(): PlayerIdentity {
  const { user, accessToken } = useAuth()
  return useMemo(() => {
    const playerId = user?.id ?? getOrCreatePlayerId()
    const playerName =
      (user?.user_metadata?.display_name as string | undefined) ?? getPlayerName()
    return { playerId, playerName, accessToken }
  }, [accessToken, user])
}
