/** Default gameplay camera — edit values here, then verify in-game with F3 dev menu. */
export const CAMERA_CONFIG = {
  position: [-0.83, 3.1, 6.56] as [number, number, number],
  target: [-0.741, -0.904, 0.582] as [number, number, number],
  fov: 28,
  near: 0.1,
  far: 200,
  minDistance: 5.0,
  maxDistance: 9.6,
  nearInteractionDistance: 9.6,
  rotateSpeed: 0.45,
  zoomSpeed: 0.45,
  panSpeed: 0.55,
  panBounds: {
    minX: -1.849,
    maxX: 0.515,
    minY: -1.481,
    maxY: 0.81,
    minZ: -0.537,
    maxZ: 0.96,
  },
  panWhenMaxTiltMinY: -0.653,
  globalMinPolar: 0.6,
  globalMaxPolar: 1.1,
  topPanMaxPolarDeg: 86.9,
}

export type CameraDebugInfo = {
  position: { x: number; y: number; z: number }
  rotationDeg: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number | null
  zoom: number
  near: number
  far: number
  distanceToTarget: number
  polarAngleDeg: number | null
  azimuthAngleDeg: number | null
  dpr: number
}

function vec3Tuple(v: { x: number; y: number; z: number }): string {
  return `[${v.x}, ${v.y}, ${v.z}]`
}

/** Paste into `CAMERA_CONFIG` in this file after adjusting the view in F3. */
export function buildCameraConfigSnippet(info: CameraDebugInfo): string {
  const fov = info.fov ?? CAMERA_CONFIG.fov
  return `position: ${vec3Tuple(info.position)} as [number, number, number],
  target: ${vec3Tuple(info.target)} as [number, number, number],
  fov: ${fov},
  // Orbit distance (zoom limits) — distance now: ${info.distanceToTarget}
  minDistance: ${CAMERA_CONFIG.minDistance},
  maxDistance: ${CAMERA_CONFIG.maxDistance},`
}

export function buildCameraPositionTargetSnippet(info: CameraDebugInfo): string {
  return `position: ${vec3Tuple(info.position)} as [number, number, number],
  target: ${vec3Tuple(info.target)} as [number, number, number],`
}
