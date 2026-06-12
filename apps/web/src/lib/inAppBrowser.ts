export type InAppBrowserKind = 'messenger' | 'zalo' | 'facebook' | 'other'

export function detectInAppBrowser(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): InAppBrowserKind | null {
  const ua = userAgent.toLowerCase()

  if (ua.includes('messenger')) {
    return 'messenger'
  }

  if (ua.includes('zalo')) {
    return 'zalo'
  }

  if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab') || ua.includes('facebook')) {
    return 'facebook'
  }

  if (
    ua.includes('instagram') ||
    ua.includes('line/') ||
    ua.includes('micromessenger') ||
    ua.includes('tiktok') ||
    ua.includes('bytedancewebview') ||
    (ua.includes('android') && ua.includes('wv'))
  ) {
    return 'other'
  }

  return null
}

export function isInAppBrowser(userAgent?: string): boolean {
  return detectInAppBrowser(userAgent) !== null
}

export function isIosDevice(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /iphone|ipad|ipod/i.test(userAgent)
}

export function getInAppBrowserLabel(kind: InAppBrowserKind): string {
  switch (kind) {
    case 'messenger':
      return 'Messenger'
    case 'zalo':
      return 'Zalo'
    case 'facebook':
      return 'Facebook'
    default:
      return 'trình duyệt trong ứng dụng'
  }
}

export function getOpenInBrowserHint(kind: InAppBrowserKind, ios: boolean): string {
  if (kind === 'messenger') {
    return ios
      ? 'Bấm ⋯ ở góc dưới → chọn 「Mở trong Safari」'
      : 'Bấm ⋯ → chọn 「Mở bằng trình duyệt」 hoặc Chrome'
  }

  if (kind === 'zalo') {
    return ios
      ? 'Bấm ⋯ góc dưới → chọn 「Mở bằng Safari」'
      : 'Bấm menu ⋮ → chọn 「Mở bằng trình duyệt」'
  }

  if (kind === 'facebook') {
    return ios
      ? 'Bấm ⋯ ở góc dưới → chọn 「Mở trong Safari」'
      : 'Bấm ⋯ → mở bằng Chrome hoặc trình duyệt mặc định'
  }

  return ios
    ? 'Mở link trong Safari hoặc Chrome để đăng nhập Google'
    : 'Mở link trong Chrome để đăng nhập Google'
}

export async function copyPageUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch {
    return false
  }
}
