import * as THREE from 'three'

let boardGradientMap: THREE.CanvasTexture | null = null
let pawnGradientMap: THREE.CanvasTexture | null = null

function createGradientTexture(
  stops: Array<[number, string]>,
  options?: { nearest?: boolean },
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not create gradient map')
  }

  const gradient = ctx.createLinearGradient(0, 0, 4, 0)
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color)
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 4, 1)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = options?.nearest ? THREE.NearestFilter : THREE.LinearFilter
  texture.magFilter = options?.nearest ? THREE.NearestFilter : THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** Muted board ramp — stays behind saturated pawns. */
export function getBoardGradientMap(): THREE.CanvasTexture {
  if (!boardGradientMap) {
    boardGradientMap = createGradientTexture([
      [0, '#98b8a8'],
      [0.38, '#b8d4b8'],
      [0.65, '#e0eee0'],
      [1, '#f8fcf8'],
    ])
  }
  return boardGradientMap
}

/** Stronger bands so piece color reads on matching tiles. */
export function getPawnGradientMap(): THREE.CanvasTexture {
  if (!pawnGradientMap) {
    pawnGradientMap = createGradientTexture([
      [0, '#3a5850'],
      [0.28, '#6a9088'],
      [0.52, '#c0e0b8'],
      [1, '#ffffff'],
    ])
  }
  return pawnGradientMap
}

/** @deprecated Use getBoardGradientMap */
export const getCartoonGradientMap = getBoardGradientMap

function tuneColor(color: THREE.Color, { lightness, saturation }: { lightness: number; saturation: number }) {
  const next = color.clone()
  next.offsetHSL(0, saturation, lightness)
  return next
}

function extractSourceMaps(material?: THREE.Material) {
  const source = material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined
  const base = source?.color ? source.color.clone() : new THREE.Color('#c8dcc8')
  return {
    color: base,
    map: source && 'map' in source ? (source as THREE.MeshStandardMaterial).map ?? null : null,
    opacity: source?.opacity ?? 1,
    transparent: source?.transparent ?? false,
  }
}

/** Board — flat faces + soft toon (reference low-poly look). */
function enableFlatShading(mat: THREE.Material): void {
  ;(mat as THREE.MeshLambertMaterial).flatShading = true
}

export function toBoardCartoonMaterial(source?: THREE.Material): THREE.MeshToonMaterial {
  const { color, map, opacity, transparent } = extractSourceMaps(source)

  const mat = new THREE.MeshToonMaterial({
    color: tuneColor(color, { lightness: 0.06, saturation: -0.06 }),
    map,
    gradientMap: getBoardGradientMap(),
    transparent,
    opacity,
  })
  enableFlatShading(mat)
  return mat
}

export function toPawnCartoonMaterial(source?: THREE.Material): THREE.MeshToonMaterial {
  const { color, map, opacity, transparent } = extractSourceMaps(source)

  const mat = new THREE.MeshToonMaterial({
    color: tuneColor(color, { lightness: -0.04, saturation: 0.42 }),
    map,
    gradientMap: getPawnGradientMap(),
    transparent,
    opacity,
  })
  enableFlatShading(mat)
  return mat
}

export function toPropMaterial(source?: THREE.Material): THREE.MeshLambertMaterial {
  const { color, map, opacity, transparent } = extractSourceMaps(source)

  const mat = new THREE.MeshLambertMaterial({
    color: tuneColor(color, { lightness: 0.02, saturation: 0.28 }),
    map,
    transparent,
    opacity,
  })
  enableFlatShading(mat)
  return mat
}

export function toBoardSimpleMaterial(source?: THREE.Material): THREE.MeshLambertMaterial {
  const { color, map, opacity, transparent } = extractSourceMaps(source)

  const mat = new THREE.MeshLambertMaterial({
    color: tuneColor(color, { lightness: 0.14, saturation: -0.02 }),
    map,
    transparent,
    opacity,
  })
  enableFlatShading(mat)
  return mat
}

export function toPawnSimpleMaterial(source?: THREE.Material): THREE.MeshLambertMaterial {
  const { color, map, opacity, transparent } = extractSourceMaps(source)

  const mat = new THREE.MeshLambertMaterial({
    color: tuneColor(color, { lightness: 0.08, saturation: 0.22 }),
    map,
    transparent,
    opacity,
  })
  enableFlatShading(mat)
  return mat
}

export function toBoardBasicMaterial(source?: THREE.Material): THREE.MeshBasicMaterial {
  const { color, map, opacity, transparent } = extractSourceMaps(source)

  return new THREE.MeshBasicMaterial({
    color: tuneColor(color, { lightness: 0.16, saturation: 0.02 }),
    map,
    transparent,
    opacity,
  })
}

export function toPawnBasicMaterial(source?: THREE.Material): THREE.MeshBasicMaterial {
  const { color, map, opacity, transparent } = extractSourceMaps(source)

  return new THREE.MeshBasicMaterial({
    color: tuneColor(color, { lightness: 0.1, saturation: 0.28 }),
    map,
    transparent,
    opacity,
  })
}

export function toPropBasicMaterial(source?: THREE.Material): THREE.MeshBasicMaterial {
  const { color, map, opacity, transparent } = extractSourceMaps(source)

  return new THREE.MeshBasicMaterial({
    color: tuneColor(color, { lightness: 0.12, saturation: 0.24 }),
    map,
    transparent,
    opacity,
  })
}

export type ApplyCartoonMaterialsOptions = {
  castShadow?: boolean
  receiveShadow?: boolean
  variant?: 'board' | 'pawn' | 'prop'
  /** When false, use flat Lambert materials (performance preset). */
  cartoonMaterials?: boolean
  /** Unlit basic materials — fastest; pair with brighter ambient in low preset. */
  basicMaterials?: boolean
}

export function applyCartoonMaterialsToObject(
  object: THREE.Object3D,
  options: ApplyCartoonMaterialsOptions = {},
): void {
  const {
    castShadow = false,
    receiveShadow = false,
    variant = 'board',
    cartoonMaterials = true,
    basicMaterials = false,
  } = options

  const toMaterial = cartoonMaterials
    ? variant === 'pawn'
      ? toPawnCartoonMaterial
      : variant === 'prop'
        ? toPropMaterial
        : toBoardCartoonMaterial
    : basicMaterials
      ? variant === 'pawn'
        ? toPawnBasicMaterial
        : variant === 'prop'
          ? toPropBasicMaterial
          : toBoardBasicMaterial
      : variant === 'pawn'
        ? toPawnSimpleMaterial
        : toBoardSimpleMaterial

  object.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) {
      return
    }

    const mesh = node as THREE.Mesh
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((mat) => toMaterial(mat))
      return
    }

    mesh.material = toMaterial(mesh.material)
  })
}

export function applyMaterialOpacity(material: THREE.Material, opacity: number): void {
  material.transparent = opacity < 0.98
  material.opacity = opacity
  material.depthWrite = opacity >= 0.98
  material.needsUpdate = true
}

/** @deprecated Use toBoardCartoonMaterial */
export const toCartoonMaterial = toBoardCartoonMaterial
