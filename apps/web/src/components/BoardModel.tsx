import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import {
  applyCartoonMaterialsToObject,
  toBoardBasicMaterial,
  toBoardCartoonMaterial,
  toBoardSimpleMaterial,
} from '../lib/sceneMaterials'
import type { GraphicsQuality } from '../lib/graphicsQuality'
import { getGraphicsQualityFlags } from '../lib/graphicsQuality'

const MODEL_PATH = '/assets/models/glb_scene.glb'

type BoardModelProps = {
  shadowsEnabled?: boolean
  graphicsQuality?: GraphicsQuality
}

export default function BoardModel({
  shadowsEnabled = true,
  graphicsQuality = 'high',
}: BoardModelProps) {
  const { scene } = useGLTF(MODEL_PATH)
  const { cartoonMaterials, basicMaterials } = getGraphicsQualityFlags(graphicsQuality)
  const toBoardMaterial = cartoonMaterials
    ? toBoardCartoonMaterial
    : basicMaterials
      ? toBoardBasicMaterial
      : toBoardSimpleMaterial

  const normalizedScene = useMemo(() => {
    const clone = scene.clone(true)
    let meshCount = 0

    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        meshCount += 1
        const mesh = node as THREE.Mesh
        mesh.userData.boardSurface = true

        if (!mesh.material) {
          mesh.material = toBoardMaterial()
        }

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => toBoardMaterial(mat))
        } else {
          mesh.material = toBoardMaterial(mesh.material)
        }
      }
    })

    applyCartoonMaterialsToObject(clone, {
      variant: 'board',
      castShadow: shadowsEnabled,
      receiveShadow: shadowsEnabled,
      cartoonMaterials,
      basicMaterials,
    })

    if (meshCount === 0) {
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.6, 4),
        toBoardMaterial(),
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
  }, [scene, shadowsEnabled, graphicsQuality, cartoonMaterials, basicMaterials])

  return <primitive object={normalizedScene} />
}

useGLTF.preload(MODEL_PATH)
