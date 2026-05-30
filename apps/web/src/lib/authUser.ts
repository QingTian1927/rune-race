import type { User } from '@supabase/supabase-js'
import { displayNameFromMetadata, isRegisteredFromMetadata } from '@rune-race/shared'

export function isRegisteredUser(user: User | null | undefined): boolean {
  if (!user) return false
  return isRegisteredFromMetadata(user.user_metadata as Record<string, unknown>)
}

export function isAnonUser(user: User | null | undefined): boolean {
  if (!user) return false
  return user.user_metadata?.is_anon === true
}

export function getDisplayName(user: User | null | undefined): string {
  const fromMeta = displayNameFromMetadata(user?.user_metadata as Record<string, unknown>)
  return fromMeta ?? 'Player'
}
