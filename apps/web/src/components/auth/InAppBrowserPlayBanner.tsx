import { useMemo } from 'react'
import { detectInAppBrowser, getInAppBrowserLabel } from '../../lib/inAppBrowser'

export function InAppBrowserPlayBanner() {
  const kind = useMemo(() => detectInAppBrowser(), [])

  if (!kind) return null

  const appLabel = getInAppBrowserLabel(kind)

  return (
    <div className="iab-play-banner" role="status">
      <i className="bi bi-info-circle-fill iab-play-banner-icon" aria-hidden="true" />
      <p className="iab-play-banner-text">
        Bạn đang mở từ <strong>{appLabel}</strong> — vẫn chơi được ngay. Muốn đăng nhập Google
        thì mở trang trong Safari hoặc Chrome.
      </p>
    </div>
  )
}
