/** Public site URL for canonical links and Open Graph (build-time). */
export const SITE_URL =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') ?? 'https://rune-race.onrender.com'

export const SITE_NAME = 'Rune Race'

export const DEFAULT_OG_IMAGE = `${SITE_URL}/marketing/images/rune-race-hero.webp`

/** Brand mark used as favicon and apple-touch-icon across all routes. */
export const SITE_FAVICON = '/marketing/images/rune-race-mark.svg'
