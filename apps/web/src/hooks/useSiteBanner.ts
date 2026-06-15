import { useCallback, useEffect, useState } from 'react'
import type { PublicSiteBanner } from '@rune-race/shared'
import { fetchSiteBanner } from '../lib/api'
import { dismissSiteBanner, getDismissedSiteBannerId } from '../lib/bannerDismiss'

export function useSiteBanner() {
  const [banner, setBanner] = useState<PublicSiteBanner | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const payload = await fetchSiteBanner()
        if (cancelled || !payload.active || !payload.banner) return
        if (getDismissedSiteBannerId() === payload.banner.id) return
        setBanner(payload.banner)
        setVisible(true)
      } catch {
        // banner is optional — ignore fetch errors
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(() => {
    if (!banner) return
    dismissSiteBanner(banner.id)
    setVisible(false)
  }, [banner])

  return { banner, visible, dismiss }
}
