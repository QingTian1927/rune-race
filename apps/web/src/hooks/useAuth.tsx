import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthResponse, Session, User } from '@supabase/supabase-js'
import { fullNameFromMetadata } from '@rune-race/shared'
import { supabase } from '../lib/supabase'
import { clearStoredPlayerId, syncPlayerIdFromAuth } from '../lib/playerSession'
import { clearRememberedAnonUserId, linkAnonSessionIfNeeded, rememberAnonUserId } from '../lib/linkAnonSession'
import { isRegisteredUser } from '../lib/authUser'
import { isInAppBrowser } from '../lib/inAppBrowser'

type AuthContextValue = {
  user: User | null
  session: Session | null
  accessToken: string | null
  loading: boolean
  isRegistered: boolean
  signUp: (params: {
    email: string
    password: string
    fullName: string
    displayName: string
    phone?: string
  }) => Promise<AuthResponse>
  signIn: (params: { email: string; password: string }) => Promise<AuthResponse>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateEmail: (email: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function syncGoogleUserMetadata(user: User): void {
  if (!isRegisteredUser(user)) return
  const meta = user.user_metadata as Record<string, unknown>
  if (meta.custom_display_name === true) return
  const fullName = fullNameFromMetadata(meta)
  const patch: Record<string, string | boolean> = {}
  if (!meta.full_name && fullName) patch.full_name = fullName
  if (Object.keys(patch).length === 0) return
  void supabase.auth.updateUser({ data: patch })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const next = data.session ?? null
      setSession(next)
      if (next?.user) {
        syncPlayerIdFromAuth(next.user.id)
        if (next.user.user_metadata?.is_anon) rememberAnonUserId(next.user.id)
        syncGoogleUserMetadata(next.user)
      }
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null)
      setLoading(false)
      if (newSession?.user) {
        syncPlayerIdFromAuth(newSession.user.id)
        if (newSession.user.user_metadata?.is_anon) {
          rememberAnonUserId(newSession.user.id)
        } else {
          clearRememberedAnonUserId()
          if (newSession.access_token) {
            void linkAnonSessionIfNeeded(newSession.access_token, newSession.user.id)
          }
        }
        syncGoogleUserMetadata(newSession.user)
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
      isRegistered: isRegisteredUser(user),
      signUp: async ({ email, password, fullName, displayName, phone }) => {
        return supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              display_name: displayName.trim(),
              phone: phone?.trim() || null,
              is_anon: false,
            },
          },
        })
      },
      signIn: async ({ email, password }) => {
        // Avoid sending a stale user JWT on the password grant (can break CORS preflight).
        await supabase.auth.signOut({ scope: 'local' })
        return supabase.auth.signInWithPassword({ email, password })
      },
      signInWithGoogle: async () => {
        if (isInAppBrowser()) {
          throw new Error(
            'Google không hỗ trợ đăng nhập trong trình duyệt của ứng dụng. Hãy mở trang trong Safari hoặc Chrome.',
          )
        }
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/login` },
        })
      },
      signOut: async () => {
        await supabase.auth.signOut()
        clearStoredPlayerId()
        clearRememberedAnonUserId()
      },
      updateEmail: async (email: string) => {
        const { error } = await supabase.auth.updateUser({ email: email.trim() })
        return { error: error ? new Error(error.message) : null }
      },
    }
  }, [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
