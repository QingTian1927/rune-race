import type { Camera, Scene } from 'three'
import { Raycaster, Vector2, Vector3 } from 'three'

export function getBoardIntersectionPoint(
  clientX: number,
  clientY: number,
  camera: Camera,
  scene: Scene,
  canvas: HTMLCanvasElement,
): Vector3 | null {
  const rect = canvas.getBoundingClientRect()
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1

  const raycaster = new Raycaster()
  raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera)

  const hits = raycaster.intersectObjects(scene.children, true)
  for (const hit of hits) {
    const obj = hit.object as {
      isMesh?: boolean
      userData?: Record<string, unknown>
      geometry?: { type?: string; parameters?: { radius?: number } }
    }
    if (!obj.isMesh) continue
    if (obj.userData?.editorHelper) continue

    const isBoard =
      obj.userData?.boardSurface === true || obj.userData?.editorInteractionSurface === true
    if (!isBoard) continue

    const geomType = obj.geometry?.type
    if (geomType === 'PlaneGeometry') continue
    if (geomType === 'SphereGeometry' && (obj.geometry?.parameters?.radius ?? 0) <= 0.05) {
      continue
    }

    return hit.point.clone()
  }

  return null
}
