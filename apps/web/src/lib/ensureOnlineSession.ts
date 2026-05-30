import { updateDisplayName } from './api'
import { getDisplayName, isRegisteredUser } from './authUser'
import { rememberAnonUserId, clearRememberedAnonUserId } from './linkAnonSession'
import { getOrCreatePlayerId, getPlayerName, syncPlayerIdFromAuth } from './playerSession'
import { supabase } from './supabase'

export type OnlineSession = {
  playerId: string
  playerName: string
  accessToken: string | null
}

/**
 * Ensures a Supabase session exists before online play (lazy anon auth).
 * Reuses registered session when present; otherwise creates anonymous user.
 */
export async function ensureOnlineSession(displayName: string): Promise<OnlineSession> {
  const trimmed = displayName.trim() || getPlayerName() || 'Player'
  const { data: sessionData } = await supabase.auth.getSession()
  let session = sessionData.session

  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { is_anon: true, display_name: trimmed } },
    })
    if (error) throw error
    session = data.session ?? null
  }

  if (!session?.user) {
    return {
      playerId: getOrCreatePlayerId(),
      playerName: trimmed,
      accessToken: null,
    }
  }

  const user = session.user
  syncPlayerIdFromAuth(user.id)

  if (isRegisteredUser(user)) {
    clearRememberedAnonUserId()
  } else {
    rememberAnonUserId(user.id)
    const currentName = getDisplayName(user)
    if (currentName !== trimmed) {
      await updateDisplayName(session.access_token, trimmed)
      await supabase.auth.refreshSession()
    }
  }

  const refreshed = (await supabase.auth.getSession()).data.session
  const activeUser = refreshed?.user ?? user

  return {
    playerId: activeUser.id,
    playerName: getDisplayName(activeUser),
    accessToken: refreshed?.access_token ?? session.access_token,
  }
}
