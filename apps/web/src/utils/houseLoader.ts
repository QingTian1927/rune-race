import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { applyCartoonMaterialsToObject } from '../lib/sceneMaterials'

function cloneScene(scene: THREE.Group): THREE.Group {
  const clone = scene.clone(true)
  clone.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return
    const mesh = node as THREE.Mesh
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone())
    } else if (mesh.material) {
      mesh.material = mesh.material.clone()
    }
  })
  return clone
}

function tintObject(object: THREE.Object3D, tintHex: string) {
  const tint = new THREE.Color(tintHex)
  object.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return
    const mesh = node as THREE.Mesh
    const applyTint = (material: THREE.Material) => {
      if (!('color' in material)) return
      const mat = material as THREE.MeshStandardMaterial
      if (mat.color) {
        mat.color.lerp(tint, 0.55)
      }
    }
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(applyTint)
    } else if (mesh.material) {
      applyTint(mesh.material)
    }
  })
}

export type NormalizeHouseGlbOptions = {
  targetSize?: { x: number; y: number; z: number }
  tintHex?: string
  castShadow?: boolean
  cartoonMaterials?: boolean
  basicMaterials?: boolean
}

export function normalizeHouseGlb(
  scene: THREE.Group,
  {
    targetSize = { x: 1, y: 0.55, z: 1 },
    tintHex,
    castShadow = true,
    cartoonMaterials = true,
    basicMaterials = false,
  }: NormalizeHouseGlbOptions = {},
) {
  const clone = cloneScene(scene)
  const box = new THREE.Box3().setFromObject(clone)
  if (box.isEmpty()) return clone

  const size = new THREE.Vector3()
  box.getSize(size)
  const scale = Math.min(
    targetSize.x / Math.max(size.x, 1e-6),
    targetSize.y / Math.max(size.y, 1e-6),
    targetSize.z / Math.max(size.z, 1e-6),
  )
  clone.scale.setScalar(scale)

  const scaledBox = new THREE.Box3().setFromObject(clone)
  const center = new THREE.Vector3()
  scaledBox.getCenter(center)
  clone.position.set(-center.x, -scaledBox.min.y, -center.z)

  if (tintHex) tintObject(clone, tintHex)

  applyCartoonMaterialsToObject(clone, {
    variant: 'board',
    castShadow,
    receiveShadow: true,
    cartoonMaterials,
    basicMaterials,
  })

  return clone
}

export function preloadHouseModels(paths: string[]) {
  for (const path of paths) {
    useGLTF.preload(path)
  }
}
