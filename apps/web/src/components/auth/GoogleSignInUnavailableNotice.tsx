import { useMemo, useState } from 'react'
import {
  copyPageUrl,
  detectInAppBrowser,
  getInAppBrowserLabel,
  getOpenInBrowserHint,
  isIosDevice,
} from '../../lib/inAppBrowser'

type GoogleSignInUnavailableNoticeProps = {
  /** Shorter copy for compact layouts (e.g. modal). */
  compact?: boolean
}

export function GoogleSignInUnavailableNotice({ compact = false }: GoogleSignInUnavailableNoticeProps) {
  const kind = useMemo(() => detectInAppBrowser(), [])
  const [copied, setCopied] = useState(false)

  if (!kind) return null

  const appLabel = getInAppBrowserLabel(kind)
  const openHint = getOpenInBrowserHint(kind, isIosDevice())

  const handleCopy = async () => {
    const ok = await copyPageUrl()
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="google-signin-iab-notice" role="note" aria-live="polite">
      <div className="google-signin-iab-notice-head">
        <i className="bi bi-google google-signin-iab-notice-icon" aria-hidden="true" />
        <span className="google-signin-iab-notice-title">Đăng nhập Google không khả dụng</span>
      </div>
      <p className="google-signin-iab-notice-body">
        {compact ? (
          <>
            Google chặn đăng nhập trong {appLabel}. {openHint}, hoặc dùng email/mật khẩu bên trên.
          </>
        ) : (
          <>
            Google không cho phép đăng nhập trong {appLabel}. {openHint}, rồi bấm「Tiếp tục với
            Google」lại — hoặc đăng nhập bằng email và mật khẩu.
          </>
        )}
      </p>
      <button type="button" className="copy-pill google-signin-iab-copy" onClick={() => void handleCopy()}>
        {copied ? (
          <>
            <i className="bi bi-check2-circle inline-icon" aria-hidden="true" /> Đã copy link!
          </>
        ) : (
          <>
            <i className="bi bi-clipboard-check inline-icon" aria-hidden="true" /> Sao chép link trang
          </>
        )}
      </button>
    </div>
  )
}
