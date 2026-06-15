import { useLayoutEffect, useRef } from 'react'
import { useSiteBanner } from '../../hooks/useSiteBanner'

type SiteBannerProps = {
  placement?: 'sky' | 'marketing'
}

export function SiteBanner({ placement = 'marketing' }: SiteBannerProps) {
  const { banner, visible, dismiss } = useSiteBanner()
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!visible || placement !== 'sky') return

    const root = rootRef.current
    if (!root) return

    const syncHeight = () => {
      const height = root.getBoundingClientRect().height
      document.documentElement.style.setProperty('--site-banner-height', `${height}px`)
      document.documentElement.classList.add('site-banner-sky-active')
    }

    syncHeight()
    const observer = new ResizeObserver(syncHeight)
    observer.observe(root)

    return () => {
      observer.disconnect()
      document.documentElement.classList.remove('site-banner-sky-active')
      document.documentElement.style.removeProperty('--site-banner-height')
    }
  }, [visible, placement])

  if (!visible || !banner) return null

  const linkLabel = banner.linkLabel?.trim() || 'Xem thêm'

  return (
    <div
      ref={rootRef}
      className={`site-banner${placement === 'sky' ? ' site-banner--sky' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="site-banner-inner">
        <div className="site-banner-message">
          <p className="site-banner-text">{banner.message}</p>
          {banner.linkUrl ? (
            <a
              className="site-banner-link"
              href={banner.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => dismiss()}
            >
              {linkLabel}
            </a>
          ) : null}
        </div>
        <button
          type="button"
          className="site-banner-close"
          aria-label="Đóng thông báo"
          onClick={() => dismiss()}
        >
          <svg className="site-banner-close-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
