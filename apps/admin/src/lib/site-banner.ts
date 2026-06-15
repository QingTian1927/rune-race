import {
  SITE_BANNER_DEFAULT_DURATION_DAYS,
  SITE_BANNER_DEFAULT_LINK_LABEL,
  SITE_BANNER_MESSAGE_MAX_LENGTH,
  type SiteBannerAdminStatus,
} from '@rune-race/shared'

export function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function datetimeLocalValueToIso(value: string): string | null {
  if (!value.trim()) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function defaultBannerUntilLocalValue(from = new Date()): string {
  const end = new Date(from.getTime() + SITE_BANNER_DEFAULT_DURATION_DAYS * 24 * 60 * 60 * 1000)
  return isoToDatetimeLocalValue(end.toISOString())
}

export function siteBannerStatusLabel(status: SiteBannerAdminStatus): string {
  switch (status) {
    case 'live':
      return 'Đang hiển thị'
    case 'scheduled':
      return 'Đã hẹn — chưa tới giờ'
    case 'expired':
      return 'Hết hạn'
    case 'off':
      return 'Đang tắt'
    default:
      return 'Chưa cấu hình'
  }
}

export {
  SITE_BANNER_DEFAULT_DURATION_DAYS,
  SITE_BANNER_DEFAULT_LINK_LABEL,
  SITE_BANNER_MESSAGE_MAX_LENGTH,
}
