import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export const ACCOUNT_NUDGE_SETTING_KEY = 'account_nudge_enabled'

type AppSettingsRow = {
  key: string
  setting_value: unknown
}

/** Hard kill switch via env (e.g. Render). When false, nudge is off regardless of DB. */
export function isAccountNudgeEnvDisabled(): boolean {
  return process.env.ACCOUNT_NUDGE_ENABLED === 'false'
}

function parseBooleanJson(value: unknown): boolean | null {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

function isMissingAppSettingsError(error: PostgrestError): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST204' ||
    /app_settings/i.test(error.message ?? '')
  )
}

function isUnknownColumnError(error: PostgrestError, column: string): boolean {
  return (
    error.code === '42703' ||
    (error.code === 'PGRST204' && (error.message ?? '').includes(column))
  )
}

type LegacyAppSettingsRow = { key: string; value: unknown }

async function readAccountNudgeRow(
  supabase: SupabaseClient,
): Promise<AppSettingsRow | LegacyAppSettingsRow | null> {
  const modern = await supabase
    .from('app_settings')
    .select('key, setting_value')
    .eq('key', ACCOUNT_NUDGE_SETTING_KEY)
    .maybeSingle()

  if (!modern.error) {
    return modern.data as AppSettingsRow | null
  }
  if (isMissingAppSettingsError(modern.error)) {
    return null
  }
  if (!isUnknownColumnError(modern.error, 'setting_value')) {
    return null
  }

  const legacy = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('key', ACCOUNT_NUDGE_SETTING_KEY)
    .maybeSingle()

  if (legacy.error) return null
  return legacy.data as LegacyAppSettingsRow | null
}

export async function getAccountNudgeEnabled(
  supabase: SupabaseClient | null,
): Promise<boolean> {
  if (isAccountNudgeEnvDisabled()) return false
  if (!supabase) return true

  const row = await readAccountNudgeRow(supabase)
  if (!row) return true

  const raw =
    'setting_value' in row ? row.setting_value : (row as LegacyAppSettingsRow).value
  const parsed = parseBooleanJson(raw)
  return parsed ?? true
}

export async function setAccountNudgeEnabled(
  supabase: SupabaseClient,
  enabled: boolean,
  updatedAt = new Date().toISOString(),
): Promise<void> {
  const modern = await supabase.from('app_settings').upsert(
    {
      key: ACCOUNT_NUDGE_SETTING_KEY,
      setting_value: enabled,
      updated_at: updatedAt,
    },
    { onConflict: 'key' },
  )
  if (!modern.error) return

  if (isMissingAppSettingsError(modern.error)) {
    throw new Error(
      'app_settings table is missing — run Supabase migration 20260608_app_settings.sql',
    )
  }
  if (!isUnknownColumnError(modern.error, 'setting_value')) {
    throw new Error(`Failed to update feature flag: ${modern.error.message}`)
  }

  const legacy = await supabase.from('app_settings').upsert(
    {
      key: ACCOUNT_NUDGE_SETTING_KEY,
      value: enabled,
      updated_at: updatedAt,
    },
    { onConflict: 'key' },
  )
  if (legacy.error) {
    throw new Error(`Failed to update feature flag: ${legacy.error.message}`)
  }
}

export type PublicFeatureFlags = {
  accountNudgeEnabled: boolean
}

export async function getPublicFeatureFlags(
  supabase: SupabaseClient | null,
): Promise<PublicFeatureFlags> {
  return {
    accountNudgeEnabled: await getAccountNudgeEnabled(supabase),
  }
}
