/** Toggle via DevTools: localStorage.setItem('rune-race-shadows', '0' | '1') */
export const SCENE_SHADOWS_STORAGE_KEY = 'rune-race-shadows'

export function readSceneShadowsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SCENE_SHADOWS_STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    // ignore private mode / blocked storage
  }
  return true
}

export function writeSceneShadowsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SCENE_SHADOWS_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}
