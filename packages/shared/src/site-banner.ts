export const SITE_BANNER_SETTING_KEY = 'site_banner'
export const SITE_BANNER_DEFAULT_DURATION_DAYS = 7
export const SITE_BANNER_MESSAGE_MAX_LENGTH = 200
export const SITE_BANNER_DEFAULT_LINK_LABEL = 'Xem thêm'
export const SITE_BANNER_DISMISS_STORAGE_KEY = 'rune-race-banner-dismissed'

export type SiteBannerConfig = {
  id: string
  enabled: boolean
  message: string
  linkUrl: string | null
  linkLabel: string
  visibleFrom: string | null
  visibleUntil: string | null
}

export type PublicSiteBanner = Pick<SiteBannerConfig, 'id' | 'message' | 'linkUrl' | 'linkLabel'>

export type SiteBannerAdminStatus = 'empty' | 'off' | 'scheduled' | 'live' | 'expired'

export function normalizeSiteBannerMessage(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function defaultSiteBannerVisibleUntil(from = new Date()): string {
  const end = new Date(from.getTime() + SITE_BANNER_DEFAULT_DURATION_DAYS * 24 * 60 * 60 * 1000)
  return end.toISOString()
}

export function isValidSiteBannerLinkUrl(url: string | null | undefined): boolean {
  if (!url) return true
  const trimmed = url.trim()
  return /^https?:\/\/\S+$/i.test(trimmed)
}

export function isSiteBannerScheduleActive(
  config: Pick<SiteBannerConfig, 'enabled' | 'message' | 'visibleFrom' | 'visibleUntil'>,
  now = new Date(),
): boolean {
  if (!config.enabled) return false
  if (!normalizeSiteBannerMessage(config.message)) return false

  const ts = now.getTime()
  if (config.visibleFrom) {
    const from = Date.parse(config.visibleFrom)
    if (!Number.isNaN(from) && ts < from) return false
  }
  if (config.visibleUntil) {
    const until = Date.parse(config.visibleUntil)
    if (!Number.isNaN(until) && ts >= until) return false
  }
  return true
}

export function getSiteBannerAdminStatus(
  config: SiteBannerConfig | null,
  now = new Date(),
): SiteBannerAdminStatus {
  if (!config) return 'empty'
  if (!config.enabled || !normalizeSiteBannerMessage(config.message)) return 'off'

  const ts = now.getTime()
  if (config.visibleFrom) {
    const from = Date.parse(config.visibleFrom)
    if (!Number.isNaN(from) && ts < from) return 'scheduled'
  }
  if (config.visibleUntil) {
    const until = Date.parse(config.visibleUntil)
    if (!Number.isNaN(until) && ts >= until) return 'expired'
  }
  return 'live'
}
