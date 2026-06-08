const PHONE_MAX_WIDTH_PX = 820
const LANDSCAPE_HINT_DISMISS_KEY = 'rune-race-landscape-hint-dismissed'

export function isPortraitOrientation(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(orientation: portrait)').matches
}

/** Phone-like device: coarse pointer + narrow width, or mobile UA (excluding tablets). */
export function isPhoneDevice(): boolean {
  if (typeof window === 'undefined') return false

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const narrowScreen = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`).matches
  const mobileUa = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  )
  const isTablet =
    /iPad/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  return !isTablet && narrowScreen && (coarsePointer || mobileUa)
}

export function shouldOfferLandscapeHint(): boolean {
  if (typeof window === 'undefined') return false
  if (localStorage.getItem(LANDSCAPE_HINT_DISMISS_KEY) === '1') return false
  return isPhoneDevice() && isPortraitOrientation()
}

export function dismissLandscapeHintPermanent(): void {
  localStorage.setItem(LANDSCAPE_HINT_DISMISS_KEY, '1')
}

export function landscapeHintMediaQueries(): MediaQueryList[] {
  return [
    window.matchMedia('(orientation: portrait)'),
    window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`),
    window.matchMedia('(pointer: coarse)'),
  ]
}
