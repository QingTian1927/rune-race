import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { applyCartoonMaterialsToObject } from '../lib/sceneMaterials'

export const HORSE_MODEL_PATHS = [
  '/assets/models/red_horse.glb',
  '/assets/models/blue_horse.glb',
  '/assets/models/green_horse.glb',
  '/assets/models/yellow_horse.glb',
] as const

const PLAYER_MODEL_PATHS = HORSE_MODEL_PATHS

function cloneScene(scene: THREE.Group): THREE.Group {
  const clone = scene.clone(true)

  clone.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) {
      return
    }

    const mesh = node as THREE.Mesh
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone())
    } else if (mesh.material) {
      mesh.material = mesh.material.clone()
    }
  })

  return clone
}

export function getPawnModelPath(playerIndex: number) {
  return PLAYER_MODEL_PATHS[((playerIndex % PLAYER_MODEL_PATHS.length) + PLAYER_MODEL_PATHS.length) % PLAYER_MODEL_PATHS.length]
}

export function normalizePawnModel(
  scene: THREE.Group,
  targetSize: { x: number; y: number; z: number } = { x: 0.28, y: 0.24, z: 0.28 },
) {
  const clone = cloneScene(scene)
  const box = new THREE.Box3().setFromObject(clone)

  if (box.isEmpty()) {
    return clone
  }

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

  // Slight sink so hard shadows meet the ground plane (avoids "floating" look).
  clone.position.set(-center.x, -scaledBox.min.y - 0.004, -center.z)
  applyCartoonMaterialsToObject(clone, {
    variant: 'pawn',
    castShadow: true,
    receiveShadow: false,
  })
  return clone
}

for (const path of PLAYER_MODEL_PATHS) {
  useGLTF.preload(path)
}
