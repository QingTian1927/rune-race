import { useMemo } from 'react'
import type { GameState, Player, PlayerColor, RuneClientView } from '@rune-race/shared'
import { getMainTrackCell } from '../../lib/placementCellPick'
import { triggerModeForMarker } from '../../lib/runeMarkerDisplay'
import { RuneMapPin3D, RUNE_MARKER_Y_OFFSET } from './RuneMapPin3D'
import { usePlayerAvatars } from '../../hooks/usePlayerAvatars'
import { useRuneMarkerVisibility } from '../../contexts/RuneMarkerVisibilityContext'

type RuneMarkersProps = {
  gameState: GameState
  runeView: RuneClientView | null
  localPlayerId?: string
}

const FALLBACK_COLOR: PlayerColor = 'blue'

export default function RuneMarkers({ gameState }: RuneMarkersProps) {
  const avatars = usePlayerAvatars(gameState.players.map((p) => p.id))
  const markerVisibility = useRuneMarkerVisibility()
  const markers = markerVisibility?.visibleMarkers ?? gameState.rune?.markers ?? []
  const playerById = useMemo(() => {
    const map = new Map<string, Player>()
    gameState.players.forEach((p) => map.set(p.id, p))
    return map
  }, [gameState.players])

  if (markers.length === 0) return null

  return (
    <group>
      {markers.map((marker) => {
        const cell = getMainTrackCell(marker.cellId)
        if (!cell) return null

        const identity = playerById.get(marker.displayedIdentityId)
        const color = identity?.color ?? FALLBACK_COLOR
        const avatarEmoji = identity ? avatars[identity.id] : undefined
        const triggerMode = triggerModeForMarker(marker)

        return (
          <group key={marker.markerId} position={[cell.x, cell.y + RUNE_MARKER_Y_OFFSET, cell.z]}>
            <RuneMapPin3D
              color={color}
              avatarEmoji={avatarEmoji}
              triggerMode={triggerMode}
            />
          </group>
        )
      })}
    </group>
  )
}
