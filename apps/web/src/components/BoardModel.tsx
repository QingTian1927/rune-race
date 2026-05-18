import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

const MODEL_PATH = '/assets/models/glb_scene.glb'

function toBasicMaterial(material?: THREE.Material): THREE.MeshBasicMaterial {
  if (material && 'map' in material) {
    const mapped = material as THREE.MeshStandardMaterial
    return new THREE.MeshBasicMaterial({ color: mapped.color, map: mapped.map ?? null })
  }

  return new THREE.MeshBasicMaterial({ color: '#b8c4d9' })
}

export default function BoardModel() {
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
          mesh.material = new THREE.MeshBasicMaterial({ color: '#b8c4d9' })
        }

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => toBasicMaterial(mat))
        } else {
          mesh.material = toBasicMaterial(mesh.material)
        }
      }
    })

    if (meshCount === 0) {
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.6, 4),
        new THREE.MeshBasicMaterial({ color: '#5f6f8a' }),
      )
      fallback.position.set(0, 0.3, 0)
      fallback.userData.boardSurface = true
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
  }, [scene])

  return <primitive object={normalizedScene} />
}

useGLTF.preload(MODEL_PATH)
