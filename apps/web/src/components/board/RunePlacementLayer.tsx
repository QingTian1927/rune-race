import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Player, PlayerColor } from '@rune-race/shared'
import { getBoardIntersectionPoint } from '../../lib/boardRaycast'
import { getMainTrackCell, pickNearestPlacementCell } from '../../lib/placementCellPick'
import { RuneMapPin3D, RUNE_MARKER_Y_OFFSET } from './RuneMapPin3D'

const MARKER_Y_OFFSET = RUNE_MARKER_Y_OFFSET
const RING_INNER = 0.032
const RING_OUTER = 0.044

type RunePlacementLayerProps = {
  active: boolean
  validCellIds: number[]
  hoveredCellId: number | null
  selectedCellId: number | null
  previewPlayer: Player | null
  previewAvatar?: string | null
  onHoverCell: (cellId: number | null) => void
  onSelectCell: (cellId: number) => void
}

function cellWorldPosition(cellId: number) {
  const cell = getMainTrackCell(cellId)
  if (!cell) return null
  return new THREE.Vector3(cell.x, cell.y + MARKER_Y_OFFSET, cell.z)
}

function RunePlacementPointerHandler({
  active,
  validCellIds,
  onHoverCell,
  onSelectCell,
}: Pick<RunePlacementLayerProps, 'active' | 'validCellIds' | 'onHoverCell' | 'onSelectCell'>) {
  const { camera, scene, gl } = useThree()
  const lastHoverRef = useRef<number | null>(null)
  const validKey = validCellIds.join(',')

  useEffect(() => {
    if (!active) {
      lastHoverRef.current = null
      onHoverCell(null)
      gl.domElement.style.cursor = ''
      return
    }

    const validIds = validCellIds

    const pickCell = (clientX: number, clientY: number) => {
      const hit = getBoardIntersectionPoint(clientX, clientY, camera, scene, gl.domElement)
      if (!hit) return null
      return pickNearestPlacementCell(hit.x, hit.z, validIds)
    }

    const onPointerMove = (event: PointerEvent) => {
      const cellId = pickCell(event.clientX, event.clientY)
      if (cellId === lastHoverRef.current) return
      lastHoverRef.current = cellId
      onHoverCell(cellId)
      gl.domElement.style.cursor = cellId !== null ? 'pointer' : 'default'
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const cellId = pickCell(event.clientX, event.clientY)
      if (cellId === null) return
      onSelectCell(cellId)
    }

    const onPointerLeave = () => {
      if (lastHoverRef.current === null) return
      lastHoverRef.current = null
      onHoverCell(null)
      gl.domElement.style.cursor = ''
    }

    gl.domElement.addEventListener('pointermove', onPointerMove)
    gl.domElement.addEventListener('pointerdown', onPointerDown)
    gl.domElement.addEventListener('pointerleave', onPointerLeave)

    return () => {
      gl.domElement.removeEventListener('pointermove', onPointerMove)
      gl.domElement.removeEventListener('pointerdown', onPointerDown)
      gl.domElement.removeEventListener('pointerleave', onPointerLeave)
      gl.domElement.style.cursor = ''
      lastHoverRef.current = null
    }
  }, [active, camera, gl, onHoverCell, onSelectCell, scene, validCellIds, validKey])

  return null
}

function PlacementRing({
  cellId,
  color,
  opacity,
}: {
  cellId: number
  color: string
  opacity: number
}) {
  const pos = cellWorldPosition(cellId)
  if (!pos) return null
  return (
    <mesh position={[pos.x, pos.y - MARKER_Y_OFFSET + 0.03, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[RING_INNER, RING_OUTER, 24]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function PlacementGhost({
  cellId,
  color,
  avatarEmoji,
}: {
  cellId: number
  color: PlayerColor
  avatarEmoji?: string | null
}) {
  const pos = cellWorldPosition(cellId)
  if (!pos) return null

  return (
    <group position={pos}>
      <RuneMapPin3D color={color} avatarEmoji={avatarEmoji} ghost />
    </group>
  )
}

export default function RunePlacementLayer({
  active,
  validCellIds,
  hoveredCellId,
  selectedCellId,
  previewPlayer,
  previewAvatar = null,
  onHoverCell,
  onSelectCell,
}: RunePlacementLayerProps) {
  const ghostCellId = useMemo(() => {
    if (hoveredCellId !== null) return hoveredCellId
    if (selectedCellId !== null) return selectedCellId
    return null
  }, [hoveredCellId, selectedCellId])

  if (!active || validCellIds.length === 0) {
    return null
  }

  const showHoverRing =
    hoveredCellId !== null && hoveredCellId !== selectedCellId ? hoveredCellId : null

  return (
    <>
      <RunePlacementPointerHandler
        active={active}
        validCellIds={validCellIds}
        onHoverCell={onHoverCell}
        onSelectCell={onSelectCell}
      />

      {showHoverRing !== null ? (
        <PlacementRing cellId={showHoverRing} color="#ffd740" opacity={0.65} />
      ) : null}

      {selectedCellId !== null ? (
        <PlacementRing cellId={selectedCellId} color="#4a9cf5" opacity={0.85} />
      ) : null}

      {ghostCellId !== null && previewPlayer ? (
        <PlacementGhost
          cellId={ghostCellId}
          color={previewPlayer.color}
          avatarEmoji={previewAvatar}
        />
      ) : null}
    </>
  )
}
