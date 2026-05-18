import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Vector3,
  Group,
  Object3D,
  BufferGeometry,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Line,
  LineBasicMaterial,
  EdgesGeometry,
  LineSegments,
  Points,
  PointsMaterial,
  Color,
} from 'three'
import { BoardLayoutData, EditorMode, getPlayerColor, BoxBounds } from '../utils/boardEditorState'

interface BoardEditorVisualizationProps {
  isActive: boolean
  data: BoardLayoutData
  mode: EditorMode
  selectedPlayer: number
  hoverPos?: { x: number; y: number; z: number } | null
  previewBox?: BoxBounds | null
}

export const BoardEditorVisualization: React.FC<BoardEditorVisualizationProps> = ({
  isActive,
  data,
  mode,
  selectedPlayer,
  hoverPos = null,
  previewBox = null,
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

    // Render home lane points for current player (contrasting per-player colors)
    if (mode === 'home-lane' || mode === 'select') {
      const homeLane = data.players[selectedPlayer].homeLane
      // Per-spec mapping: P0 Red, P1 Blue, P2 Green, P3 Yellow
      const homeLaneColors = ['#ff3333', '#0066ff', '#00cc00', '#ffcc00']
      const color = homeLaneColors[selectedPlayer] || getPlayerColor(selectedPlayer)

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

    // Render saved boxes for selected player
    if ((mode === 'stable' || mode === 'home' || mode === 'select') && data.players[selectedPlayer]) {
      const ply = data.players[selectedPlayer]
      const drawBox = (b: BoxBounds | null | undefined, colorHex: string, opacity = 0.12) => {
        if (!b) return
        const geom = new BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ)
        const mesh = new Mesh(geom, new MeshBasicMaterial({ color: colorHex, transparent: true, opacity }))
        mesh.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2)
        // apply rotation around Y if present
        if (b.rotationY) mesh.rotation.y = b.rotationY
        groupRef.current.add(markAsEditorHelper(mesh))
        // Add clear edges for contrast
        const edgesGeom = new EdgesGeometry(geom)
        const edge = new LineSegments(edgesGeom, new LineBasicMaterial({ color: '#ffffff', linewidth: 2 }))
        edge.position.copy(mesh.position)
        if (b.rotationY) edge.rotation.y = b.rotationY
        groupRef.current.add(markAsEditorHelper(edge))
      }

      // stable: dark blue (match main track) - stronger opacity
      drawBox(ply.stable, '#0066ff', 0.45)
      // home: bright pink for strong contrast - stronger opacity
      drawBox(ply.home, '#ff2fbf', 0.55)
    }

    // Render preview box if present
    if (previewBox && (mode === 'stable' || mode === 'home')) {
      const b = previewBox
      const geom = new BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ)
      const mesh = new Mesh(geom, new MeshBasicMaterial({ color: '#ffff66', transparent: true, opacity: 0.35 }))
      mesh.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2)
      if (b.rotationY) mesh.rotation.y = b.rotationY
      groupRef.current.add(markAsEditorHelper(mesh))
      const edgesGeom = new EdgesGeometry(geom)
      const edge = new LineSegments(edgesGeom, new LineBasicMaterial({ color: '#ffff66', linewidth: 2 }))
      edge.position.copy(mesh.position)
      if (b.rotationY) edge.rotation.y = b.rotationY
      groupRef.current.add(markAsEditorHelper(edge))
    }
  })

  return <group ref={groupRef} />
}
