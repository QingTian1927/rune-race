import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchProfile, type Profile } from '../lib/api'
import { setPlayerName, syncPlayerIdFromAuth } from '../lib/playerSession'
import { useAuth } from './useAuth'

type PlayerProfileContextValue = {
  profile: Profile | null
  loading: boolean
  refetch: () => Promise<void>
  /** True while establishing anonymous Supabase session for guests. */
  bootstrapping: boolean
}

const PlayerProfileContext = createContext<PlayerProfileContextValue | null>(null)

export function PlayerProfileProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, loading: authLoading, signInAnonymously, user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const guestBootstrapStarted = useRef(false)

  useEffect(() => {
    if (user?.id) syncPlayerIdFromAuth(user.id)
  }, [user?.id])

  useEffect(() => {
    if (authLoading || accessToken || guestBootstrapStarted.current) return
    guestBootstrapStarted.current = true
    setBootstrapping(true)
    signInAnonymously()
      .catch(() => {
        // Anonymous auth may be disabled in Supabase; guests can still use local name only.
      })
      .finally(() => setBootstrapping(false))
  }, [accessToken, authLoading, signInAnonymously])

  const refetch = useCallback(async () => {
    if (!accessToken) {
      setProfile(null)
      return
    }
    setLoading(true)
    try {
      const data = await fetchProfile(accessToken)
      setProfile(data)
      const name = data.display_name?.trim()
      if (name) setPlayerName(name)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const value = useMemo(
    () => ({ profile, loading, refetch, bootstrapping }),
    [profile, loading, refetch, bootstrapping],
  )

  return (
    <PlayerProfileContext.Provider value={value}>{children}</PlayerProfileContext.Provider>
  )
}

export function usePlayerProfile(): PlayerProfileContextValue {
  const ctx = useContext(PlayerProfileContext)
  if (!ctx) {
    throw new Error('usePlayerProfile must be used within PlayerProfileProvider')
  }
  return ctx
}
