import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3, Vector2, Raycaster, Matrix3 } from 'three'
import { BoardLayoutData, EditorMode } from '../utils/boardEditorState'

interface BoardEditorInputHandlerProps {
  isActive: boolean
  data: BoardLayoutData
  mode: EditorMode
  selectedPlayer: number
  onDataChange: (data: BoardLayoutData) => void
  onHoverChange?: (pos: { x: number; y: number; z: number } | null) => void
}

export const BoardEditorInputHandler: React.FC<BoardEditorInputHandlerProps> = ({
  isActive,
  data,
  mode,
  selectedPlayer,
  onDataChange,
  onHoverChange,
}) => {
  const { camera, scene, gl } = useThree()
  const isDrawingBoxRef = useRef(false)
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const DRAG_THRESHOLD_PX = 6

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

    const handleMouseDown = (e: MouseEvent) => {
      // start drag tracking
      dragStartXRef.current = e.clientX
      dragStartYRef.current = e.clientY
      isDraggingRef.current = false
    }

    const handleMouseUp = (e: MouseEvent) => {
      // update dragging state based on total movement between down and up
      const dxTotal = e.clientX - dragStartXRef.current
      const dyTotal = e.clientY - dragStartYRef.current
      if (Math.sqrt(dxTotal * dxTotal + dyTotal * dyTotal) > DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true
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
      if (onHoverChange && e.target === gl.domElement) {
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

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('click', handleClick)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
    }
    }, [isActive, mode, selectedPlayer, data, camera, scene, gl, onDataChange, onHoverChange])

  return null
}
