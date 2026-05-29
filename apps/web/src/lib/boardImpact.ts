import * as THREE from 'three'

/** Visual puff variants — `capture_hit` is mainly for SFX; capture still uses legacy burst mesh. */
export type ImpactPuffKind = 'step_land' | 'spawn_exit' | 'capture_hit'

export type BoardImpactEvent = {
  kind: ImpactPuffKind
  position: THREE.Vector3
  tokenId?: string
  playerIndex?: number
}

/**
 * Hook surface for board impacts (SFX, haptics, analytics).
 * Wire `onImpact` from GameView / BoardScene when audio is ready.
 */
export type BoardImpactFeedback = {
  onImpact?: (event: BoardImpactEvent) => void
  /**
   * When true, skip puff meshes but still call `onImpact` (for optional quiet SFX later).
   * Read via `readReducedMotionPreference()` — settings UI not implemented yet.
   */
  reducedMotion?: boolean
}

export const BOARD_FEEDBACK_STORAGE_KEY = 'rune-race-reduced-motion'

export function readReducedMotionPreference(): boolean {
  try {
    return localStorage.getItem(BOARD_FEEDBACK_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export type ImpactPuffVisualConfig = {
  durationMs: number
  sphereCount: number
  baseScale: number
  lift: number
  ringScaleEnd: number
  colors: { core: string; ring: string }
  /** Scales puffOpacity (default 1). */
  opacityMul?: number
  /** Scales horizontal spread of spheres (default 1). */
  radiusMul?: number
}

export const IMPACT_PUFF_CONFIG: Record<ImpactPuffKind, ImpactPuffVisualConfig> = {
  step_land: {
    durationMs: 250,
    sphereCount: 4,
    baseScale: 0.046,
    lift: 0.085,
    ringScaleEnd: 0.92,
    opacityMul: 0.52,
    radiusMul: 0.75,
    colors: { core: '#c7b492', ring: '#e2d9c8' },
  },
  spawn_exit: {
    durationMs: 380,
    sphereCount: 8,
    baseScale: 0.072,
    lift: 0.2,
    ringScaleEnd: 1.55,
    colors: { core: '#d4bc8a', ring: '#f5ecd8' },
  },
  capture_hit: {
    durationMs: 320,
    sphereCount: 6,
    baseScale: 0.065,
    lift: 0.16,
    ringScaleEnd: 1.35,
    colors: { core: '#e8dfd0', ring: '#ffffff' },
  },
}

const POOL_SIZE = 12

export function createImpactPuffId(): string {
  return `puff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export type ActiveImpactPuff = {
  id: string
  kind: ImpactPuffKind
  position: THREE.Vector3
  startTime: number
}

export { POOL_SIZE }

export function puffProgress(elapsedMs: number, durationMs: number): number {
  return THREE.MathUtils.clamp(elapsedMs / durationMs, 0, 1)
}

/** Ease-out for expanding ring; spheres fade faster. */
export function puffOpacity(progress: number, layer: 'sphere' | 'ring', opacityMul = 1): number {
  if (layer === 'ring') {
    return (1 - progress) * 0.42 * opacityMul
  }
  const peak = 1 - Math.abs(progress - 0.25) * 2.2
  return THREE.MathUtils.clamp(peak, 0, 1) * 0.55 * opacityMul
}

export function puffSphereOffset(
  index: number,
  count: number,
  progress: number,
  lift: number,
  radiusMul = 1,
): THREE.Vector3 {
  const angle = (index / count) * Math.PI * 2 + progress * 0.6
  const radius = (0.04 + progress * 0.14) * radiusMul
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    0.03 + progress * lift + (index % 3) * 0.02,
    Math.sin(angle) * radius,
  )
}
