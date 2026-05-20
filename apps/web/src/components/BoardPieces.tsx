import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GameState, Token } from '@rune-race/shared'
import boardLayout from '../../data/board-layout.json'
import { loadPawnModel } from '../utils/pawnLoader'
import type { MockMoveEventDetails, MockPathStep } from '../mock/mockGameEngine'

interface BoardPiecesProps {
  gameState: GameState
  animationDurationMs?: number
}

type CaptureMotion = {
  key: string
  sourcePosition: THREE.Vector3
  targetPosition: THREE.Vector3
}

type CaptureEventDetails = {
  tokenId: string
  playerId: string
  capturedTokenId: string
  from?: MockPathStep
  to?: MockPathStep
}

const PLAYER_COLOR_HEX: Record<GameState['players'][number]['color'], string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#facc15',
}

function vecFrom(o: any) {
  return new THREE.Vector3(o.x, o.y, o.z)
}

function smoothArcPosition(start: THREE.Vector3, end: THREE.Vector3, progress: number) {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1)
  const lifted = Math.sin(Math.PI * clamped)
  const position = new THREE.Vector3().lerpVectors(start, end, clamped)
  position.y += lifted * 0.24
  return position
}

function setOpacity(object: THREE.Object3D, opacity: number) {
  object.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) {
      return
    }

    const mesh = node as THREE.Mesh
    const applyMaterial = (material: THREE.Material) => {
      const materialWithOpacity = material as THREE.MeshBasicMaterial & {
        opacity?: number
        transparent?: boolean
        depthWrite?: boolean
      }
      materialWithOpacity.transparent = true
      materialWithOpacity.opacity = opacity
      materialWithOpacity.depthWrite = opacity >= 0.98
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(applyMaterial)
      return
    }

    if (mesh.material) {
      applyMaterial(mesh.material)
    }
  })
}

function getBoardDirectionMultiplier() {
  return boardLayout.meta.direction === 'cw' ? -1 : 1
}

function getTrackWorldPosition(playerIndex: number, trackProgress: number) {
  const playerLayout = boardLayout.players[playerIndex]
  if (!playerLayout) {
    return new THREE.Vector3()
  }

  const direction = getBoardDirectionMultiplier()
  const trackIndex = ((playerLayout.startIndex + trackProgress * direction) % boardLayout.mainTrack.length + boardLayout.mainTrack.length) % boardLayout.mainTrack.length
  const point = boardLayout.mainTrack[trackIndex]
  return point ? vecFrom(point) : new THREE.Vector3()
}

function getHomeLaneWorldPosition(playerIndex: number, laneIndex: number) {
  const lane = boardLayout.players[playerIndex]?.homeLane?.[laneIndex]
  return lane ? vecFrom(lane) : new THREE.Vector3()
}

function getStableSlotWorldPosition(playerIndex: number, tokenId: string) {
  const stable = boardLayout.players[playerIndex]?.stable
  if (!stable) {
    return new THREE.Vector3()
  }

  const cols = 2
  const rows = 2
  const slot = Number(tokenId.split(':').pop() ?? '0') % (cols * rows)
  const cx = (stable.minX + stable.maxX) / 2
  const cz = (stable.minZ + stable.maxZ) / 2
  const width = stable.maxX - stable.minX
  const depth = stable.maxZ - stable.minZ
  const col = slot % cols
  const row = Math.floor(slot / cols)

  return new THREE.Vector3(
    cx + (col - (cols - 1) / 2) * (width * 0.28),
    stable.minY + (stable.maxY - stable.minY) * 0.12,
    cz + (row - (rows - 1) / 2) * (depth * 0.28),
  )
}

function getStableSlotWorldPositionForSlot(playerIndex: number, slot: number) {
  const stable = boardLayout.players[playerIndex]?.stable
  if (!stable) {
    return new THREE.Vector3()
  }

  const cols = 2
  const rows = 2
  const normalizedSlot = ((slot % (cols * rows)) + cols * rows) % (cols * rows)
  const cx = (stable.minX + stable.maxX) / 2
  const cz = (stable.minZ + stable.maxZ) / 2
  const width = stable.maxX - stable.minX
  const depth = stable.maxZ - stable.minZ
  const col = normalizedSlot % cols
  const row = Math.floor(normalizedSlot / cols)

  return new THREE.Vector3(
    cx + (col - (cols - 1) / 2) * (width * 0.28),
    stable.minY + (stable.maxY - stable.minY) * 0.12,
    cz + (row - (rows - 1) / 2) * (depth * 0.28),
  )
}

function tokenStateToWorldPosition(token: Token, playerIndex: number) {
  if (token.state === 'in_base') {
    return getStableSlotWorldPosition(playerIndex, token.id)
  }

  if (token.state === 'on_track') {
    return getTrackWorldPosition(playerIndex, token.position)
  }

  if (token.state === 'in_home_lane') {
    return getHomeLaneWorldPosition(playerIndex, token.position)
  }

  const home = boardLayout.players[playerIndex]?.home
  if (!home) {
    return new THREE.Vector3()
  }

  return new THREE.Vector3(
    (home.minX + home.maxX) / 2,
    (home.minY + home.maxY) / 2,
    (home.minZ + home.maxZ) / 2,
  )
}

function motionPlanFromEvent(eventDetails: MockMoveEventDetails | undefined, playerIndex: number) {
  if (!eventDetails) {
    return null
  }

  return eventDetails.path.map((step: MockPathStep) => {
    if (step.state === 'on_track') {
      return getTrackWorldPosition(playerIndex, step.position)
    }

    if (step.state === 'in_home_lane') {
      return getHomeLaneWorldPosition(playerIndex, step.position)
    }

    if (step.state === 'in_base') {
      return getStableSlotWorldPosition(playerIndex, eventDetails.tokenId)
    }

    return new THREE.Vector3()
  })
}

function captureMotionFromEvent(
  eventDetails: CaptureEventDetails | undefined,
  playerIndexById: Record<string, number>,
  token: Token,
): CaptureMotion | null {
  if (!eventDetails?.capturedTokenId || !eventDetails.from || !eventDetails.to) {
    return null
  }

  const moverIndex = playerIndexById[eventDetails.playerId] ?? -1
  if (moverIndex < 0) {
    return null
  }

  const targetPlayerIndex = playerIndexById[token.playerId] ?? 0

  return {
    key: `${eventDetails.tokenId}:${eventDetails.capturedTokenId}:${eventDetails.to.state}:${eventDetails.to.position}`,
    sourcePosition: getTrackWorldPosition(moverIndex, eventDetails.from.position),
    targetPosition: getStableSlotWorldPositionForSlot(targetPlayerIndex, eventDetails.to.position),
  }
}

function HousePlaceholder({ box, color = '#ffffff' }: { box: any; color?: string }) {
  if (!box) return null
  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const w = box.maxX - box.minX
  const h = box.maxY - box.minY
  const d = box.maxZ - box.minZ

  // base + roof + chimney
  const baseColor = new THREE.Color(color)
  const roofColor = baseColor.clone().offsetHSL(0, 0, -0.18).getStyle()
  const chimneyColor = baseColor.clone().offsetHSL(0, -0.4, -0.45).getStyle()

  return (
    <group position={[cx, cy, cz]} rotation-y={box.rotationY ?? 0}>
      <mesh position={[0, -h * 0.12, 0]}>
        <boxGeometry args={[w * 0.9, h * 0.6, d * 0.9]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <mesh position={[0, h * 0.18, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[w * 0.98, h * 0.2, d * 0.98]} />
        <meshBasicMaterial color={roofColor} />
      </mesh>

      <mesh position={[w * 0.28, h * 0.22, -d * 0.18]}>
        <boxGeometry args={[w * 0.12, h * 0.18, d * 0.12]} />
        <meshBasicMaterial color={chimneyColor} />
      </mesh>
    </group>
  )
}

function PawnInstance({
  token,
  playerIndex,
  targetPosition,
  motionPlan,
  captureMotion,
  animationDurationMs = 300,
}: {
  token: Token
  playerIndex: number
  targetPosition: THREE.Vector3
  motionPlan: THREE.Vector3[] | null
  captureMotion: CaptureMotion | null
  animationDurationMs?: number
}) {
  const modelRef = useRef<THREE.Group | null>(null)
  const effectRef = useRef<THREE.Group | null>(null)
  const queueRef = useRef<THREE.Vector3[]>([])
  const segmentStartRef = useRef(new THREE.Vector3())
  const segmentTargetRef = useRef(new THREE.Vector3())
  const segmentStartTimeRef = useRef<number>(-1)
  const motionKeyRef = useRef<string>('')
  const captureKeyRef = useRef<string>('')
  const captureStartTimeRef = useRef<number>(-1)
  const capturePhaseRef = useRef<'idle' | 'hit' | 'return' | 'done'>('idle')

  useEffect(() => {
    let mounted = true
    loadPawnModel(playerIndex).then((g) => {
      if (!mounted) return
      const node = g.clone()
      if (modelRef.current) {
        modelRef.current.add(node)
      }
    })
    return () => {
      mounted = false
    }
  }, [playerIndex])

  // If the pawn was just captured, ensure the model appears at the hit source
  // as soon as it's mounted so it doesn't briefly appear at its base slot.
  useEffect(() => {
    if (!modelRef.current || !captureMotion) return
    try {
      modelRef.current.position.copy(captureMotion.sourcePosition)
      modelRef.current.scale.setScalar(1)
    } catch (e) {
      // ignore if model not ready
    }
  }, [captureMotion?.key])

  useEffect(() => {
    if (!effectRef.current) {
      return
    }

    if (!captureMotion) {
      captureKeyRef.current = ''
      captureStartTimeRef.current = -1
      capturePhaseRef.current = 'idle'
      setOpacity(effectRef.current, 0)
      return
    }

    if (captureKeyRef.current === captureMotion.key) {
      return
    }

    captureKeyRef.current = captureMotion.key
    captureStartTimeRef.current = -1
    capturePhaseRef.current = 'hit'
    setOpacity(effectRef.current, 1)
  }, [captureMotion])

  useEffect(() => {
    if (!modelRef.current || captureMotion) {
      return
    }

    const nextMotionKey = motionPlan && motionPlan.length > 0
      ? `${token.id}:${token.state}:${token.position}:${motionPlan.length}:${motionPlan[0].x}:${motionPlan[0].y}:${motionPlan[0].z}`
      : `${token.id}:${token.state}:${token.position}`

    if (motionKeyRef.current === nextMotionKey) {
      return
    }

    motionKeyRef.current = nextMotionKey

    if (!motionPlan || motionPlan.length === 0) {
      queueRef.current = []
      segmentStartTimeRef.current = -1
      modelRef.current.position.copy(targetPosition)
      return
    }

    queueRef.current = motionPlan.map((point) => point.clone())
    segmentStartRef.current.copy(modelRef.current.position)
    segmentTargetRef.current.copy(queueRef.current[0] ?? targetPosition)
    segmentStartTimeRef.current = -1
  }, [captureMotion, motionPlan, targetPosition, token.id, token.position, token.state])

  useFrame((state) => {
    if (!modelRef.current) return

    if (captureMotion) {
      const hitDuration = 180 / 1000
      const returnDuration = 620 / 1000

      if (captureStartTimeRef.current < 0 && capturePhaseRef.current !== 'done') {
        captureStartTimeRef.current = state.clock.elapsedTime
      }

      const elapsed = state.clock.elapsedTime - captureStartTimeRef.current

      if (effectRef.current) {
        effectRef.current.position.copy(captureMotion.sourcePosition)
        const burstProgress = THREE.MathUtils.clamp(elapsed / hitDuration, 0, 1)
        const burstScale = 0.35 + burstProgress * 1.05
        effectRef.current.scale.setScalar(burstScale)
        setOpacity(effectRef.current, 1 - burstProgress)
      }

      if (capturePhaseRef.current === 'hit' && elapsed < hitDuration) {
        const hitProgress = elapsed / hitDuration
        const wobble = Math.sin(state.clock.elapsedTime * 52) * (1 - hitProgress) * 0.045
        const lift = Math.sin(hitProgress * Math.PI) * 0.18
        modelRef.current.position.copy(captureMotion.sourcePosition)
        modelRef.current.position.x += wobble
        modelRef.current.position.y += lift
        modelRef.current.position.z -= wobble * 0.6
        modelRef.current.scale.setScalar(1 + Math.sin(hitProgress * Math.PI) * 0.22)
        return
      }

      capturePhaseRef.current = 'return'
      const returnProgress = THREE.MathUtils.clamp((elapsed - hitDuration) / returnDuration, 0, 1)
      modelRef.current.position.copy(smoothArcPosition(captureMotion.sourcePosition, captureMotion.targetPosition, returnProgress))
      modelRef.current.scale.setScalar(1 - returnProgress * 0.05)

      if (returnProgress >= 1) {
        modelRef.current.position.copy(captureMotion.targetPosition)
        modelRef.current.scale.setScalar(1)
        capturePhaseRef.current = 'done'
        if (effectRef.current) {
          setOpacity(effectRef.current, 0)
        }
      }

      return
    }

    if (queueRef.current.length === 0) {
      modelRef.current.position.copy(targetPosition)
      return
    }

    if (segmentStartTimeRef.current < 0) {
      segmentStartTimeRef.current = state.clock.elapsedTime
    }

    const duration = Math.max(1, animationDurationMs) / 1000
    const elapsed = state.clock.elapsedTime - segmentStartTimeRef.current
    const progress = Math.min(1, elapsed / duration)
    modelRef.current.position.copy(smoothArcPosition(segmentStartRef.current, segmentTargetRef.current, progress))

    if (progress >= 1) {
      queueRef.current.shift()

      if (queueRef.current.length === 0) {
        segmentStartTimeRef.current = -1
        modelRef.current.position.copy(targetPosition)
        return
      }

      segmentStartRef.current.copy(segmentTargetRef.current)
      segmentTargetRef.current.copy(queueRef.current[0])
      segmentStartTimeRef.current = state.clock.elapsedTime
    }
  })

  return (
    <group>
      <group ref={modelRef} />
      <group ref={effectRef} visible={Boolean(captureMotion)}>
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color="#e5e7eb" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.05, 0.14, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

export default function BoardPieces({ gameState, animationDurationMs = 300 }: BoardPiecesProps) {
  const layout = boardLayout as any
  const playerIndexById = useMemo(() => {
    const m: Record<string, number> = {}
    gameState.players.forEach((p, i) => (m[p.id] = i))
    return m
  }, [gameState.players])

  const moveEventByTokenId = useMemo(() => {
    const map = new Map<string, MockMoveEventDetails>()
    gameState.events.forEach((event) => {
      if (event.type !== 'token_moved') {
        return
      }

      const details = event.details as Partial<MockMoveEventDetails>
      if (!details?.tokenId || !details.path) {
        return
      }

      map.set(details.tokenId, details as MockMoveEventDetails)
    })
    return map
  }, [gameState.events])

  const captureMoveByCapturedTokenId = useMemo(() => {
    const map = new Map<string, CaptureEventDetails>()
    gameState.events.forEach((event) => {
      if (event.type !== 'token_captured') {
        return
      }

      const details = event.details as Partial<CaptureEventDetails>
      if (!details?.capturedTokenId) {
        return
      }

      map.set(details.capturedTokenId, details as CaptureEventDetails)
    })
    return map
  }, [gameState.events])

  const tokensWithTargets = useMemo(() => {
    return gameState.tokens.map((token) => {
      const playerIndex = playerIndexById[token.playerId] ?? 0
      const targetPosition = tokenStateToWorldPosition(token, playerIndex)
      const motionPlan = motionPlanFromEvent(moveEventByTokenId.get(token.id), playerIndex)
      const captureMotion = token.state === 'in_base'
        ? captureMotionFromEvent(captureMoveByCapturedTokenId.get(token.id), playerIndexById, token)
        : null

      return {
        token,
        playerIndex,
        targetPosition,
        motionPlan,
        captureMotion,
      }
    })
  }, [captureMoveByCapturedTokenId, gameState.tokens, moveEventByTokenId, playerIndexById])

  return (
    <group>
      {/* Houses */}
      {gameState.players.map((p, i) => {
        const home = (layout.players && layout.players[i] && layout.players[i].home) || null
        return <HousePlaceholder key={`house-${p.id}`} box={home} color={PLAYER_COLOR_HEX[p.color] ?? '#ddd'} />
      })}

      {/* Pawns */}
      {tokensWithTargets.map(({ token, playerIndex, targetPosition, motionPlan, captureMotion }) => (
        <group key={token.id}>
          <PawnInstance
            token={token}
            playerIndex={playerIndex}
            targetPosition={targetPosition}
            motionPlan={motionPlan}
            captureMotion={captureMotion}
            animationDurationMs={animationDurationMs}
          />
        </group>
      ))}
    </group>
  )
}
