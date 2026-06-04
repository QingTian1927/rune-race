export type GraphicsQuality = 'high' | 'low'

export const GRAPHICS_QUALITY_STORAGE_KEY = 'rune-race-graphics-quality'

/** @deprecated Migrated into {@link GRAPHICS_QUALITY_STORAGE_KEY} */
const LEGACY_SHADOWS_STORAGE_KEY = 'rune-race-shadows'

export const GRAPHICS_QUALITY_CHANGE_EVENT = 'rune-race-graphics-quality-change'

export type GraphicsQualityFlags = {
  shadows: boolean
  richLighting: boolean
  /** Ambient + one directional only (no hemisphere / fill). */
  minimalLighting: boolean
  skyDome: boolean
  cartoonMaterials: boolean
  /** Unlit MeshBasic — skips per-fragment lighting. */
  basicMaterials: boolean
  impactPuffs: boolean
  toneMapping: boolean
  antialias: boolean
  /** Fewer segments on HUD/selection primitives. */
  reduceMeshDetail: boolean
  dpr: [number, number]
}

const HIGH_FLAGS: GraphicsQualityFlags = {
  shadows: true,
  richLighting: true,
  minimalLighting: false,
  skyDome: true,
  cartoonMaterials: true,
  basicMaterials: false,
  impactPuffs: true,
  toneMapping: true,
  antialias: true,
  reduceMeshDetail: false,
  dpr: [1, 1.75],
}

const LOW_FLAGS: GraphicsQualityFlags = {
  shadows: false,
  richLighting: false,
  minimalLighting: true,
  skyDome: false,
  cartoonMaterials: false,
  basicMaterials: true,
  impactPuffs: false,
  toneMapping: false,
  antialias: false,
  reduceMeshDetail: true,
  dpr: [1, 1],
}

export function getGraphicsQualityFlags(quality: GraphicsQuality): GraphicsQualityFlags {
  return quality === 'high' ? HIGH_FLAGS : LOW_FLAGS
}

function parseStoredQuality(raw: string | null): GraphicsQuality | null {
  if (raw === 'high' || raw === 'low') return raw
  return null
}

function readLegacyShadowsDisabled(): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_SHADOWS_STORAGE_KEY)
    return raw === '0' || raw === 'false'
  } catch {
    return false
  }
}

export function readGraphicsQuality(): GraphicsQuality {
  try {
    const stored = parseStoredQuality(localStorage.getItem(GRAPHICS_QUALITY_STORAGE_KEY))
    if (stored) return stored
    if (readLegacyShadowsDisabled()) return 'low'
  } catch {
    // ignore private mode / blocked storage
  }
  return 'high'
}

export function writeGraphicsQuality(quality: GraphicsQuality): void {
  try {
    localStorage.setItem(GRAPHICS_QUALITY_STORAGE_KEY, quality)
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(GRAPHICS_QUALITY_CHANGE_EVENT, { detail: quality }))
}
