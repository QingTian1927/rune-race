import type { SupabaseClient } from '@supabase/supabase-js'
import { displayNameFromMetadata } from '@rune-race/shared'
import { PROFILE_SELECT_COLUMNS, mapDbProfileRow } from './profile-db'

function isAnonFromMetadata(metadata: Record<string, unknown> | undefined | null): boolean {
  return metadata?.is_anon === true
}

/**
 * Ensures a `profiles` row exists for a Supabase auth user.
 * Registered users: created by DB trigger on signup; this is a fallback insert.
 * Anonymous users: created only when they actually play online (lobby join / stats).
 */
export async function ensureProfileRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: existing, error: loadError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (loadError) return false
  if (existing) return true

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
  if (authError || !authData.user) return false

  const meta = authData.user.user_metadata as Record<string, unknown>
  const isAnon = isAnonFromMetadata(meta)

  const { error: insertError } = await supabase.from('profiles').insert({
    id: userId,
    phone: typeof meta.phone === 'string' ? meta.phone.trim() || null : null,
    is_anon: isAnon,
    full_name: null,
    display_name: displayNameFromMetadata(meta),
  })

  if (insertError) {
    if (insertError.code === '23505') return true
    return false
  }

  return true
}

/** Load profile row after ensure (for link-anon / analytics). */
export async function ensureProfileRowAndSelect(
  supabase: SupabaseClient,
  userId: string,
) {
  const ok = await ensureProfileRow(supabase, userId)
  if (!ok) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_COLUMNS)
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return mapDbProfileRow(data)
}
