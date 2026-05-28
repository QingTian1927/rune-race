import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type SupabaseConfig = {
  url: string
  secretKey: string
}

let cachedClient: SupabaseClient | null = null
let cachedConfig: SupabaseConfig | null = null

function loadConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !secretKey) return null
  return { url, secretKey }
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const config = loadConfig()
  if (!config) return null
  if (cachedClient && cachedConfig?.url === config.url && cachedConfig?.secretKey === config.secretKey) {
    return cachedClient
  }
  cachedConfig = config
  cachedClient = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
}

export async function getUserFromAccessToken(token: string): Promise<User | null> {
  const client = getSupabaseAdminClient()
  if (!client) return null
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
