import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchProfile, type Profile } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

type PlayerProfileContextValue = {
  profile: Profile | null
  loading: boolean
  refetch: () => Promise<void>
}

const PlayerProfileContext = createContext<PlayerProfileContextValue | null>(null)

export function PlayerProfileProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!accessToken) {
      setProfile(null)
      return
    }
    setLoading(true)
    try {
      setProfile(await fetchProfile(accessToken))
    } catch (err) {
      if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
        await supabase.auth.signOut()
      }
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const value = useMemo(
    () => ({ profile, loading, refetch }),
    [profile, loading, refetch],
  )

  return (
    <PlayerProfileContext.Provider value={value}>{children}</PlayerProfileContext.Provider>
  )
}

export function usePlayerProfile(): PlayerProfileContextValue {
  const ctx = useContext(PlayerProfileContext)
  if (!ctx) throw new Error('usePlayerProfile must be used within PlayerProfileProvider')
  return ctx
}
