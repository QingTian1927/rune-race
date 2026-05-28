import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthResponse, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearStoredPlayerId } from '../lib/playerSession'

const ANON_USER_ID_KEY = 'rune-race-anon-user-id'

type AuthContextValue = {
  user: User | null
  session: Session | null
  accessToken: string | null
  loading: boolean
  anonUserId: string | null
  signUp: (params: {
    email: string
    password: string
    displayName: string
    phone?: string
  }) => Promise<AuthResponse>
  signIn: (params: { email: string; password: string }) => Promise<AuthResponse>
  signInWithGoogle: () => Promise<void>
  signInAnonymously: () => Promise<AuthResponse>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [anonUserId, setAnonUserId] = useState<string | null>(() => {
    return localStorage.getItem(ANON_USER_ID_KEY)
  })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null)
      setLoading(false)
      if (newSession?.user?.user_metadata?.is_anon) {
        localStorage.setItem(ANON_USER_ID_KEY, newSession.user.id)
        setAnonUserId(newSession.user.id)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null
    return {
      user,
      session,
      accessToken: session?.access_token ?? null,
      loading,
      anonUserId,
      signUp: async ({ email, password, displayName, phone }) => {
        return supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              phone: phone || null,
              is_anon: false,
            },
          },
        })
      },
      signIn: async ({ email, password }) => {
        return supabase.auth.signInWithPassword({ email, password })
      },
      signInWithGoogle: async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/login` },
        })
      },
      signInAnonymously: async () => {
        if (typeof supabase.auth.signInAnonymously !== 'function') {
          throw new Error('Anonymous auth not supported')
        }
        const response = await supabase.auth.signInAnonymously({
          options: { data: { is_anon: true } },
        })
        if (response.data.user) {
          localStorage.setItem(ANON_USER_ID_KEY, response.data.user.id)
          setAnonUserId(response.data.user.id)
        }
        return response
      },
      signOut: async () => {
        await supabase.auth.signOut()
        clearStoredPlayerId()
      },
    }
  }, [anonUserId, loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
