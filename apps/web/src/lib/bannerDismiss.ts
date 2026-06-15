import { SITE_BANNER_DISMISS_STORAGE_KEY } from '@rune-race/shared'

export function getDismissedSiteBannerId(): string | null {
  try {
    return localStorage.getItem(SITE_BANNER_DISMISS_STORAGE_KEY)
  } catch {
    return null
  }
}

export function dismissSiteBanner(bannerId: string): void {
  try {
    localStorage.setItem(SITE_BANNER_DISMISS_STORAGE_KEY, bannerId)
  } catch {
    // ignore quota / private mode
  }
}
