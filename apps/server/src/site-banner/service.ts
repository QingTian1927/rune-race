import { randomUUID } from 'node:crypto'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  SITE_BANNER_DEFAULT_DURATION_DAYS,
  SITE_BANNER_DEFAULT_LINK_LABEL,
  SITE_BANNER_MESSAGE_MAX_LENGTH,
  SITE_BANNER_SETTING_KEY,
  defaultSiteBannerVisibleUntil,
  getSiteBannerAdminStatus,
  isSiteBannerScheduleActive,
  isValidSiteBannerLinkUrl,
  normalizeSiteBannerMessage,
  type PublicSiteBanner,
  type SiteBannerAdminStatus,
  type SiteBannerConfig,
} from '@rune-race/shared'

type AppSettingsRow = { key: string; setting_value: unknown }
type LegacyAppSettingsRow = { key: string; value: unknown }

export type SiteBannerPatch = {
  enabled?: boolean
  message?: string
  linkUrl?: string | null
  linkLabel?: string
  visibleFrom?: string | null
  visibleUntil?: string | null
}

export type PublicSiteBannerResponse = {
  active: boolean
  banner: PublicSiteBanner | null
}

export type AdminSiteBannerResponse = {
  siteBanner: SiteBannerConfig | null
  siteBannerStatus: SiteBannerAdminStatus
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

function parseIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return null
  return new Date(ts).toISOString()
}

function parseStoredConfig(raw: unknown): SiteBannerConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== 'string' || !row.id) return null

  return {
    id: row.id,
    enabled: row.enabled === true,
    message: typeof row.message === 'string' ? normalizeSiteBannerMessage(row.message) : '',
    linkUrl: typeof row.linkUrl === 'string' && row.linkUrl.trim() ? row.linkUrl.trim() : null,
    linkLabel:
      typeof row.linkLabel === 'string' && row.linkLabel.trim()
        ? row.linkLabel.trim()
        : SITE_BANNER_DEFAULT_LINK_LABEL,
    visibleFrom: parseIsoOrNull(row.visibleFrom),
    visibleUntil: parseIsoOrNull(row.visibleUntil),
  }
}

async function readSiteBannerRow(
  supabase: SupabaseClient,
): Promise<AppSettingsRow | LegacyAppSettingsRow | null> {
  const modern = await supabase
    .from('app_settings')
    .select('key, setting_value')
    .eq('key', SITE_BANNER_SETTING_KEY)
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
    .eq('key', SITE_BANNER_SETTING_KEY)
    .maybeSingle()

  if (legacy.error) return null
  return legacy.data as LegacyAppSettingsRow | null
}

async function writeSiteBannerRow(
  supabase: SupabaseClient,
  config: SiteBannerConfig,
  updatedAt = new Date().toISOString(),
): Promise<void> {
  const modern = await supabase.from('app_settings').upsert(
    {
      key: SITE_BANNER_SETTING_KEY,
      setting_value: config,
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
    throw new Error(`Failed to update site banner: ${modern.error.message}`)
  }

  const legacy = await supabase.from('app_settings').upsert(
    {
      key: SITE_BANNER_SETTING_KEY,
      value: config,
      updated_at: updatedAt,
    },
    { onConflict: 'key' },
  )
  if (legacy.error) {
    throw new Error(`Failed to update site banner: ${legacy.error.message}`)
  }
}

function contentFingerprint(config: SiteBannerConfig): string {
  return JSON.stringify({
    message: normalizeSiteBannerMessage(config.message),
    linkUrl: config.linkUrl,
    linkLabel: config.linkLabel,
    visibleFrom: config.visibleFrom,
    visibleUntil: config.visibleUntil,
  })
}

function shouldRotateBannerId(prev: SiteBannerConfig | null, next: SiteBannerConfig): boolean {
  if (!prev) return true
  if (!prev.enabled && next.enabled) return true
  return contentFingerprint(prev) !== contentFingerprint(next)
}

function toPublicBanner(config: SiteBannerConfig): PublicSiteBanner {
  return {
    id: config.id,
    message: normalizeSiteBannerMessage(config.message),
    linkUrl: config.linkUrl,
    linkLabel: config.linkLabel,
  }
}

export async function getSiteBannerConfig(
  supabase: SupabaseClient | null,
): Promise<SiteBannerConfig | null> {
  if (!supabase) return null
  const row = await readSiteBannerRow(supabase)
  if (!row) return null
  const raw = 'setting_value' in row ? row.setting_value : row.value
  return parseStoredConfig(raw)
}

export async function getPublicSiteBanner(
  supabase: SupabaseClient | null,
): Promise<PublicSiteBannerResponse> {
  const config = await getSiteBannerConfig(supabase)
  if (!config || !isSiteBannerScheduleActive(config)) {
    return { active: false, banner: null }
  }
  return { active: true, banner: toPublicBanner(config) }
}

export async function getAdminSiteBanner(
  supabase: SupabaseClient,
): Promise<AdminSiteBannerResponse> {
  const siteBanner = await getSiteBannerConfig(supabase)
  return {
    siteBanner,
    siteBannerStatus: getSiteBannerAdminStatus(siteBanner),
  }
}

export class SiteBannerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SiteBannerValidationError'
  }
}

function normalizePatchLinkLabel(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? fallback).trim()
  return trimmed || SITE_BANNER_DEFAULT_LINK_LABEL
}

export async function updateSiteBanner(
  supabase: SupabaseClient,
  patch: SiteBannerPatch,
): Promise<AdminSiteBannerResponse> {
  const current = await getSiteBannerConfig(supabase)
  const now = new Date()

  const merged: SiteBannerConfig = {
    id: current?.id ?? randomUUID(),
    enabled: patch.enabled ?? current?.enabled ?? false,
    message: normalizeSiteBannerMessage(patch.message ?? current?.message ?? ''),
    linkUrl:
      patch.linkUrl !== undefined
        ? patch.linkUrl && patch.linkUrl.trim()
          ? patch.linkUrl.trim()
          : null
        : (current?.linkUrl ?? null),
    linkLabel: normalizePatchLinkLabel(patch.linkLabel, current?.linkLabel ?? SITE_BANNER_DEFAULT_LINK_LABEL),
    visibleFrom:
      patch.visibleFrom !== undefined ? parseIsoOrNull(patch.visibleFrom) : (current?.visibleFrom ?? null),
    visibleUntil:
      patch.visibleUntil !== undefined ? parseIsoOrNull(patch.visibleUntil) : (current?.visibleUntil ?? null),
  }

  if (merged.enabled) {
    if (!merged.message) {
      throw new SiteBannerValidationError('message is required when banner is enabled')
    }
    if (merged.message.length > SITE_BANNER_MESSAGE_MAX_LENGTH) {
      throw new SiteBannerValidationError(
        `message must be at most ${SITE_BANNER_MESSAGE_MAX_LENGTH} characters`,
      )
    }
    if (!isValidSiteBannerLinkUrl(merged.linkUrl)) {
      throw new SiteBannerValidationError('linkUrl must be a valid http or https URL')
    }
    if (merged.linkLabel.length > 40) {
      throw new SiteBannerValidationError('linkLabel must be at most 40 characters')
    }
    if (!merged.visibleUntil) {
      merged.visibleUntil = defaultSiteBannerVisibleUntil(now)
    } else {
      const untilTs = Date.parse(merged.visibleUntil)
      if (Number.isNaN(untilTs) || untilTs <= now.getTime()) {
        merged.visibleUntil = defaultSiteBannerVisibleUntil(now)
      }
    }
    if (merged.visibleFrom && merged.visibleUntil) {
      if (Date.parse(merged.visibleFrom) >= Date.parse(merged.visibleUntil)) {
        throw new SiteBannerValidationError('visibleFrom must be before visibleUntil')
      }
    }
  }

  if (shouldRotateBannerId(current, merged)) {
    merged.id = randomUUID()
  }

  await writeSiteBannerRow(supabase, merged)
  return getAdminSiteBanner(supabase)
}

export { SITE_BANNER_DEFAULT_DURATION_DAYS }
