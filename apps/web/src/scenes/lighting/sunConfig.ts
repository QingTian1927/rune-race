/**
 * Soft golden daylight — bright fill, readable PCF-soft shadow edges.
 */
export const SUN_POSITION: [number, number, number] = [11, 18, 10]

export const SUN_SHADOW_MAP_TYPE = 'soft' as const

export const SUN_CONFIG = {
  position: SUN_POSITION,
  intensity: 1.32,
  /** Slightly less saturated than pure gold — warm, not yellow wash. */
  color: '#ffe4a8',
  shadowMapSize: 2048,
  /** PCFSoft penumbra — not too low (ragged) or high (mushy). */
  shadowRadius: 1.28,
  /** More taps = smoother shadow edges (Three.js PCFSoft). */
  shadowBlurSamples: 12,
  shadowBias: -0.0001,
  shadowNormalBias: 0.001,
  /** Tighter frustum = more texels on the board (~14u wide). */
  shadowCamera: {
    left: -12.5,
    right: 12.5,
    top: 12.5,
    bottom: -12.5,
    near: 2.5,
    far: 40,
  },
  ambient: {
    intensity: 0.8,
    color: '#fff9f0',
  },
  hemisphere: {
    intensity: 0.62,
    sky: '#fff4e8',
    ground: '#cce8a8',
  },
  fill: {
    intensity: 0.34,
    color: '#ffe8c0',
    position: [-8, 10, -6] as [number, number, number],
  },
} as const
