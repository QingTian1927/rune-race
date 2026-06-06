type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  const root = document.documentElement as FullscreenElement
  return Boolean(root.requestFullscreen ?? root.webkitRequestFullscreen)
}

export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null
  const doc = document as FullscreenDocument
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export async function requestAppFullscreen(
  element: HTMLElement = document.documentElement,
): Promise<void> {
  const el = element as FullscreenElement
  if (el.requestFullscreen) {
    await el.requestFullscreen()
    return
  }
  await el.webkitRequestFullscreen?.()
}

export async function exitAppFullscreen(): Promise<void> {
  if (!getFullscreenElement()) return
  const doc = document as FullscreenDocument
  if (document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }
  await doc.webkitExitFullscreen?.()
}

export async function toggleAppFullscreen(
  element: HTMLElement = document.documentElement,
): Promise<boolean> {
  if (getFullscreenElement()) {
    await exitAppFullscreen()
    return false
  }
  await requestAppFullscreen(element)
  return true
}
