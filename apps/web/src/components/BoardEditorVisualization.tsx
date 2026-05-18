import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Vector3,
  Group,
  Object3D,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
  Color,
} from 'three'
import { BoardLayoutData, EditorMode, getPlayerColor } from '../utils/boardEditorState'

interface BoardEditorVisualizationProps {
  isActive: boolean
  data: BoardLayoutData
  mode: EditorMode
  selectedPlayer: number
  hoverPos?: { x: number; y: number; z: number } | null
}

export const BoardEditorVisualization: React.FC<BoardEditorVisualizationProps> = ({
  isActive,
  data,
  mode,
  selectedPlayer,
  hoverPos = null,
}) => {
  const groupRef = useRef<Group>(null!)

  const markAsEditorHelper = <T extends Object3D>(object: T): T => {
    object.userData.editorHelper = true
    return object
  }

  // Render visualization
  useFrame(() => {
    if (!isActive || !groupRef.current) return

    groupRef.current.clear()

    // Render main track points as Points
    if (mode === 'main-track' || mode === 'select') {
      data.mainTrack.forEach((point) => {
        const geom = new BufferGeometry().setFromPoints([new Vector3(point.x, point.y, point.z)])
        const mat = new PointsMaterial({ color: new Color('#0066ff'), size: 6, sizeAttenuation: false })
        const pts = new Points(geom, mat)
        groupRef.current!.add(markAsEditorHelper(pts))
      })

      // Draw lines connecting points
      if (data.mainTrack.length > 1) {
        const points = data.mainTrack.map((p) => new Vector3(p.x, p.y, p.z))
        const geometry = new BufferGeometry().setFromPoints(points)
        const line = new Line(
          geometry,
          new LineBasicMaterial({ color: '#0066ff', linewidth: 2 })
        )
        groupRef.current.add(markAsEditorHelper(line))
      }
    }

    // Render home lane points for current player
    if (mode === 'home-lane' || mode === 'select') {
      const homeLane = data.players[selectedPlayer].homeLane
      const color = getPlayerColor(selectedPlayer)

      homeLane.forEach((point) => {
        const geom = new BufferGeometry().setFromPoints([new Vector3(point.x, point.y, point.z)])
        const mat = new PointsMaterial({ color: new Color(color), size: 6, sizeAttenuation: false })
        const pts = new Points(geom, mat)
        groupRef.current!.add(markAsEditorHelper(pts))
      })

      if (homeLane.length > 1) {
        const points = homeLane.map((p) => new Vector3(p.x, p.y, p.z))
        const geometry = new BufferGeometry().setFromPoints(points)
        const line = new Line(geometry, new LineBasicMaterial({ color, linewidth: 2 }))
        groupRef.current.add(markAsEditorHelper(line))
      }
    }

    // Render hover preview
    if (hoverPos && (mode === 'main-track' || mode === 'home-lane')) {
      const geom = new BufferGeometry().setFromPoints([new Vector3(hoverPos.x, hoverPos.y, hoverPos.z)])
      const mat = new PointsMaterial({ color: new Color('#ffea00'), size: 10, sizeAttenuation: false })
      const preview = new Points(geom, mat)
      groupRef.current.add(markAsEditorHelper(preview))
    }
  })

  return <group ref={groupRef} />
}
