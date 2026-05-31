import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import {
  applyCartoonMaterialsToObject,
  toBoardCartoonMaterial,
} from '../lib/sceneMaterials'

const MODEL_PATH = '/assets/models/glb_scene.glb'

type BoardModelProps = {
  shadowsEnabled?: boolean
}

export default function BoardModel({ shadowsEnabled = true }: BoardModelProps) {
  const { scene } = useGLTF(MODEL_PATH)

  const normalizedScene = useMemo(() => {
    const clone = scene.clone(true)
    let meshCount = 0

    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        meshCount += 1
        const mesh = node as THREE.Mesh
        mesh.userData.boardSurface = true

        if (!mesh.material) {
          mesh.material = toBoardCartoonMaterial()
        }

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => toBoardCartoonMaterial(mat))
        } else {
          mesh.material = toBoardCartoonMaterial(mesh.material)
        }
      }
    })

    applyCartoonMaterialsToObject(clone, {
      variant: 'board',
      castShadow: shadowsEnabled,
      receiveShadow: shadowsEnabled,
    })

    if (meshCount === 0) {
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.6, 4),
        toBoardCartoonMaterial(),
      )
      fallback.position.set(0, 0.3, 0)
      fallback.userData.boardSurface = true
      fallback.castShadow = shadowsEnabled
      fallback.receiveShadow = shadowsEnabled
      clone.add(fallback)
    }

    const box = new THREE.Box3().setFromObject(clone)
    if (box.isEmpty()) {
      return clone
    }

    const size = new THREE.Vector3()
    box.getSize(size)

    const maxAxis = Math.max(size.x, size.y, size.z) || 1
    const targetSize = 14
    const uniformScale = targetSize / maxAxis
    clone.scale.setScalar(uniformScale)

    const scaledBox = new THREE.Box3().setFromObject(clone)
    const scaledCenter = new THREE.Vector3()
    scaledBox.getCenter(scaledCenter)

    clone.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z)
    return clone
  }, [scene, shadowsEnabled])

  return <primitive object={normalizedScene} />
}

useGLTF.preload(MODEL_PATH)
