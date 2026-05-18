import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3, Vector2, Raycaster, Matrix3 } from 'three'
import { BoardLayoutData, EditorMode, BoxBounds } from '../utils/boardEditorState'

interface BoardEditorInputHandlerProps {
  isActive: boolean
  data: BoardLayoutData
  mode: EditorMode
  selectedPlayer: number
  onDataChange: (data: BoardLayoutData) => void
  onHoverChange?: (pos: { x: number; y: number; z: number } | null) => void
  onPreviewBoxChange?: (box: BoxBounds | null) => void
  editorMouseMode?: 'draw' | 'camera'
  setEditorMouseMode?: (v: 'draw' | 'camera') => void
}

export const BoardEditorInputHandler: React.FC<BoardEditorInputHandlerProps> = ({
  isActive,
  data,
  mode,
  selectedPlayer,
  onDataChange,
  onHoverChange,
  onPreviewBoxChange,
  editorMouseMode = 'draw',
  setEditorMouseMode,
}) => {
  const { camera, scene, gl } = useThree()
  const isDrawingBoxRef = useRef(false)
  const boxStartRef = useRef<Vector3 | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const DRAG_THRESHOLD_PX = 6
  const isRotatingRef = useRef(false)
  const rotateStartAngleRef = useRef(0)
  const rotateInitialRotationRef = useRef(0)
  const rotateCenterRef = useRef<Vector3 | null>(null)
  const lastEditedBoxRef = useRef<{ kind: 'stable' | 'home'; player: number } | null>(null)

  useEffect(() => {
    if (!isActive) return

    // Helper: return first valid intersection on the board model (with point and world normal)
    const getBoardIntersection = (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 2 - 1
      const y = -((clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new Raycaster()
      const mousePos = new Vector2(x, y)
      raycaster.setFromCamera(mousePos, camera)

      const intersects = raycaster.intersectObjects(scene.children, true)

      for (const hit of intersects) {
        const obj: any = hit.object
        if (!obj.isMesh) continue
        if (obj.userData?.editorHelper) continue
        if (obj.userData?.editorInteractionSurface) {
          let worldNormal = new Vector3(0, 1, 0)
          if (hit.face) {
            const normalMatrix = new Matrix3().getNormalMatrix(hit.object.matrixWorld)
            worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize()
          }

          return { point: hit.point.clone(), normal: worldNormal }
        }
        if (!obj.userData?.boardSurface) continue
        // Skip helper visualization geometry (planes / tiny spheres)
        const geomType = obj.geometry?.type
        if (geomType === 'PlaneGeometry') continue
        if (geomType === 'SphereGeometry' && obj.geometry.parameters?.radius <= 0.05) continue

        // compute world normal from face normal if available
        let worldNormal = new Vector3(0, 1, 0)
        if (hit.face) {
          const normalMatrix = new Matrix3().getNormalMatrix(hit.object.matrixWorld)
          worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize()
        }

        return { point: hit.point.clone(), normal: worldNormal }
      }

      return null
    }

    const sampleFloorYUnderRect = async (a: Vector3, b: Vector3) => {
      // sample center and corners to estimate lowest surface Y under footprint
      const minX = Math.min(a.x, b.x)
      const maxX = Math.max(a.x, b.x)
      const minZ = Math.min(a.z, b.z)
      const maxZ = Math.max(a.z, b.z)

      const samples: Array<{ x: number; z: number }> = [
        { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
        { x: minX, z: minZ },
        { x: minX, z: maxZ },
        { x: maxX, z: minZ },
        { x: maxX, z: maxZ },
      ]

      let bestY: number | null = null
      const ray = new Raycaster()
      const down = new Vector3(0, -1, 0)
      const originY = Math.max(a.y, b.y) + 5

      for (const s of samples) {
        ray.set(new Vector3(s.x, originY, s.z), down)
        const intersects = ray.intersectObjects(scene.children, true)
        for (const hit of intersects) {
          const obj: any = hit.object
          if (!obj.isMesh) continue
          if (obj.userData?.editorHelper) continue
          if (!obj.userData?.boardSurface && !obj.userData?.editorInteractionSurface) continue
          const y = hit.point.y
          if (bestY === null || y < bestY) bestY = y
          break
        }
      }

      return bestY
    }

    const handleMouseDown = (e: MouseEvent) => {
      // start drag tracking
      dragStartXRef.current = e.clientX
      dragStartYRef.current = e.clientY
      isDraggingRef.current = false
      // start box drawing when left button and in box mode
      if (e.button === 0 && (mode === 'stable' || mode === 'home') && e.target === gl.domElement && editorMouseMode === 'draw') {
        const hit = getBoardIntersection(e.clientX, e.clientY)
        if (hit) {
          boxStartRef.current = hit.point.clone()
          isDrawingBoxRef.current = true
          if (onPreviewBoxChange) onPreviewBoxChange(null)
        }
      }

      // start rotating last-edited box when right button
      if (e.button === 2 && (mode === 'stable' || mode === 'home') && e.target === gl.domElement && editorMouseMode === 'draw') {
        const last = lastEditedBoxRef.current
        if (last) {
          const b = (data.players[last.player] as any)[last.kind] as BoxBounds | null
          if (b) {
            const center = new Vector3((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2)
            const hit = getBoardIntersection(e.clientX, e.clientY)
            if (hit) {
              const v = new Vector2(hit.point.x - center.x, hit.point.z - center.z)
              const startAng = Math.atan2(v.y, v.x)
              rotateStartAngleRef.current = startAng
              rotateInitialRotationRef.current = b.rotationY ?? 0
              rotateCenterRef.current = center
              isRotatingRef.current = true
              e.preventDefault()
            }
          }
        }
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      // update dragging state based on total movement between down and up
      const dxTotal = e.clientX - dragStartXRef.current
      const dyTotal = e.clientY - dragStartYRef.current
      if (Math.sqrt(dxTotal * dxTotal + dyTotal * dyTotal) > DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true
      }

      // finish rotating if in rotation mode
      if (isRotatingRef.current) {
        isRotatingRef.current = false
        rotateCenterRef.current = null
        return
      }

      // finish box drawing when mouse up
      if (isDrawingBoxRef.current && (mode === 'stable' || mode === 'home')) {
        isDrawingBoxRef.current = false
        const start = boxStartRef.current
        boxStartRef.current = null
        if (start && e.target === gl.domElement) {
          const endHit = getBoardIntersection(e.clientX, e.clientY)
          if (endHit) {
            const end = endHit.point.clone()
            ;(async () => {
              const floorY = await sampleFloorYUnderRect(start, end)
              const minX = Math.min(start.x, end.x)
              const maxX = Math.max(start.x, end.x)
              const minZ = Math.min(start.z, end.z)
              const maxZ = Math.max(start.z, end.z)
              const bottomY = floorY ?? Math.min(start.y, end.y)
              const BOX_HEIGHT = 0.2

              const box: BoxBounds = {
                minX,
                minY: bottomY,
                minZ,
                maxX,
                maxY: bottomY + BOX_HEIGHT,
                maxZ,
                rotationY: 0,
              }

              const newData = JSON.parse(JSON.stringify(data))
              if (mode === 'stable') {
                newData.players[selectedPlayer].stable = box
              } else {
                newData.players[selectedPlayer].home = box
              }
              onDataChange(newData)
              // remember this as last edited box for potential rotation
              lastEditedBoxRef.current = { kind: mode, player: selectedPlayer }
              if (onPreviewBoxChange) onPreviewBoxChange(null)
            })()
          }
        }
        return
      }

      // Add point on mouseup if this was not a drag and not drawing a box
      if (!isDrawingBoxRef.current && !isDraggingRef.current && (mode === 'main-track' || mode === 'home-lane')) {
        // Check target is canvas and ray hits board
        if (e.target === gl.domElement) {
          const hit = getBoardIntersection(e.clientX, e.clientY)
          if (hit) {
            // offset slightly along normal so marker sits above the surface
            const surfaceEps = 0.01
            const pos = hit.point.clone().add(hit.normal.clone().multiplyScalar(surfaceEps))

            const newData = JSON.parse(JSON.stringify(data))
            if (mode === 'main-track') {
              if (newData.mainTrack.length < 44) {
                newData.mainTrack.push({ index: newData.mainTrack.length, x: pos.x, y: pos.y, z: pos.z })
              }
            } else {
              if (newData.players[selectedPlayer].homeLane.length < 5) {
                newData.players[selectedPlayer].homeLane.push({ index: newData.players[selectedPlayer].homeLane.length, x: pos.x, y: pos.y, z: pos.z })
              }
            }

            onDataChange(newData)
          }
        }
      }
    }

    // We handle add-point on mouseup (not click) to avoid click firing after drag
    const handleClick = (_e: MouseEvent) => {
      // no-op: kept for compatibility but logic moved to mouseup
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const newData = JSON.parse(JSON.stringify(data))

        if (mode === 'main-track' && newData.mainTrack.length > 0) {
          newData.mainTrack.pop()
        } else if (mode === 'home-lane' && newData.players[selectedPlayer].homeLane.length > 0) {
          newData.players[selectedPlayer].homeLane.pop()
        } else if (mode === 'stable' && newData.players[selectedPlayer].stable) {
          newData.players[selectedPlayer].stable = null
        } else if (mode === 'home' && newData.players[selectedPlayer].home) {
          newData.players[selectedPlayer].home = null
        }

        onDataChange(newData)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartXRef.current
      const dy = e.clientY - dragStartYRef.current
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true
      }

      // Compute hover position and report via callback
      if (e.target === gl.domElement) {
        // if rotating a box, compute rotation based on right-drag
        if (isRotatingRef.current) {
          const last = lastEditedBoxRef.current
          if (last && rotateCenterRef.current) {
            const hit = getBoardIntersection(e.clientX, e.clientY)
            if (hit) {
              const vcur = new Vector2(hit.point.x - rotateCenterRef.current.x, hit.point.z - rotateCenterRef.current.z)
              const curAng = Math.atan2(vcur.y, vcur.x)
              const delta = curAng - rotateStartAngleRef.current
              const newRot = rotateInitialRotationRef.current + delta
              const newData = JSON.parse(JSON.stringify(data))
              const target = (newData.players[last.player] as any)[last.kind] as BoxBounds | null
              if (target) {
                target.rotationY = newRot
                onDataChange(newData)
              }
            }
          }
          return
        }

        // if drawing a box, compute and emit preview
        if (isDrawingBoxRef.current && boxStartRef.current && (mode === 'stable' || mode === 'home')) {
          const hit = getBoardIntersection(e.clientX, e.clientY)
          if (hit) {
            const start = boxStartRef.current
            const end = hit.point.clone()
            ;(async () => {
              const floorY = await sampleFloorYUnderRect(start, end)
              const minX = Math.min(start.x, end.x)
              const maxX = Math.max(start.x, end.x)
              const minZ = Math.min(start.z, end.z)
              const maxZ = Math.max(start.z, end.z)
              const bottomY = floorY ?? Math.min(start.y, end.y)
              const BOX_HEIGHT = 0.2
              const preview: BoxBounds = {
                minX,
                minY: bottomY,
                minZ,
                maxX,
                maxY: bottomY + BOX_HEIGHT,
                maxZ,
                rotationY: 0,
              }
              if (onPreviewBoxChange) onPreviewBoxChange(preview)
            })()
          } else {
            if (onPreviewBoxChange) onPreviewBoxChange(null)
          }
          return
        }

        if (onHoverChange) {
          const hit = getBoardIntersection(e.clientX, e.clientY)
          if (hit) {
            const surfaceEps = 0.01
            const pos = hit.point.clone().add(hit.normal.clone().multiplyScalar(surfaceEps))
            onHoverChange({ x: pos.x, y: pos.y, z: pos.z })
          } else {
            onHoverChange(null)
          }
        }
      }

    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('click', handleClick)
    window.addEventListener('mousemove', handleMouseMove)
    const handleContextMenu = (ev: MouseEvent) => {
      if (isRotatingRef.current) ev.preventDefault()
    }
    window.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
    }, [isActive, mode, selectedPlayer, data, camera, scene, gl, onDataChange, onHoverChange, editorMouseMode, setEditorMouseMode, onPreviewBoxChange])

    // Ensure drawing is cancelled when mode changes to camera
    // (handled in a separate effect below)
  useEffect(() => {
    if (!isActive) return
    if (editorMouseMode !== 'draw') {
      isDrawingBoxRef.current = false
      boxStartRef.current = null
      if (onPreviewBoxChange) onPreviewBoxChange(null)
    }
  }, [editorMouseMode, isActive, onPreviewBoxChange])

  return null
}
