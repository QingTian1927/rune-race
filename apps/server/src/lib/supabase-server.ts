import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (adminClient) return adminClient
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) return null
  adminClient = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}

export async function getUserFromAccessToken(token: string): Promise<User | null> {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function getAuthDisplayName(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data.user) return null
  const meta = data.user.user_metadata as Record<string, unknown>
  const name = meta.display_name ?? meta.full_name ?? meta.name
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

export async function setAuthDisplayName(userId: string, displayName: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error: fetchError } = await supabase.auth.admin.getUserById(userId)
  if (fetchError || !data.user) throw new Error(fetchError?.message ?? 'User not found')
  const existing = data.user.user_metadata ?? {}
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { ...existing, display_name: displayName.trim() || null },
  })
  if (error) throw new Error(error.message)
}
