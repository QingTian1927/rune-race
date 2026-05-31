import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { GameState, Token } from '@rune-race/shared'
import boardLayout from '../../data/board-layout.json'
import { boardSlotForPlayer } from '../utils/boardSlots'
import {
  extractCaptureDetailsFromDelta,
  extractMoveDetailsFromDelta,
  getDeltaEventsSinceVersion,
  updateVersionCursor,
  type CaptureEventDetails,
} from '../lib/tokenMotion'
import type { ImpactPuffKind } from '../lib/boardImpact'
import ImpactPuffPool, { type SpawnImpactPuff } from './board/ImpactPuffPool'
import type { BoardImpactFeedback } from '../lib/boardImpact'
import { applyMaterialOpacity, getBoardGradientMap } from '../lib/sceneMaterials'
import { getPawnModelPath, normalizePawnModel } from '../utils/pawnLoader'
import type { MockMoveEventDetails, MockPathStep } from '../mock/mockGameEngine'

/** Downward-pointing triangle for selectable-token marker (billboard, tip toward pawn). */
const MOVE_SELECT_TRIANGLE = (() => {
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.15)
  shape.lineTo(0.12, 0.08)
  shape.lineTo(-0.12, 0.08)
  shape.closePath()
  return shape
})()

interface BoardPiecesProps {
  gameState: GameState
  animationDurationMs?: number
  selectableTokenIds?: string[]
  onSelectToken?: (tokenId: string) => void
  /** Hold token motion until dice presentation finishes. */
  freezeTokenAnimations?: boolean
  /** SFX / reduced-motion hooks (see lib/boardImpact.ts). */
  boardImpactFeedback?: BoardImpactFeedback
}

type CaptureMotion = {
  key: string
  sourcePosition: THREE.Vector3
  targetPosition: THREE.Vector3
}

type MotionWaypoint = {
  step: MockPathStep
  position: THREE.Vector3
}

const POSITION_EPSILON = 0.0008

function nearVector(a: THREE.Vector3, x: number, y: number, z: number) {
  return (
    Math.abs(a.x - x) < POSITION_EPSILON &&
    Math.abs(a.y - y) < POSITION_EPSILON &&
    Math.abs(a.z - z) < POSITION_EPSILON
  )
}

const PLAYER_COLOR_HEX: Record<GameState['players'][number]['color'], string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#facc15',
}

const TRACK_DIRECTION_RANGES = [
  { start: 0, end: 4, yaw: 0 },            // north
  { start: 5, end: 8, yaw: -Math.PI / 2 }, // east
  { start: 9, end: 10, yaw: 0 },           // north
  { start: 11, end: 15, yaw: Math.PI / 2 },// west
  { start: 16, end: 19, yaw: 0 },          // north
  { start: 20, end: 21, yaw: Math.PI / 2 },// west
  { start: 22, end: 26, yaw: Math.PI },    // south
  { start: 27, end: 30, yaw: Math.PI / 2 },// west
  { start: 31, end: 32, yaw: Math.PI },    // south
  { start: 33, end: 37, yaw: -Math.PI / 2 },// east
  { start: 38, end: 41, yaw: Math.PI },    // south
  { start: 42, end: 43, yaw: -Math.PI / 2 },// east
] as const

const PLAYER_BASE_YAWS = [
  Math.PI / 4,
  (3 * Math.PI) / 4,
  (-3 * Math.PI) / 4,
  -Math.PI / 4,
]

const PAWN_MODEL_YAW_OFFSET = (-3 * Math.PI) / 4
const MAIN_TRACK_YAW_CORRECTION = 0

function normalizeYaw(yaw: number) {
  return THREE.MathUtils.euclideanModulo(yaw + Math.PI, Math.PI * 2) - Math.PI
}

function lerpAngle(current: number, target: number, alpha: number) {
  const delta = normalizeYaw(target - current)
  return current + delta * alpha
}

function yawFromDirection(direction: THREE.Vector3) {
  if (direction.lengthSq() < 1e-8) {
    return 0
  }

  return normalizeYaw(-Math.atan2(direction.x, direction.z))
}

function getTrackYawForAbsoluteIndex(absoluteIndex: number) {
  const range = TRACK_DIRECTION_RANGES.find((candidate) => absoluteIndex >= candidate.start && absoluteIndex <= candidate.end)
  return range ? range.yaw : 0
}

function getAbsoluteTrackIndex(playerIndex: number, trackProgress: number) {
  const playerLayout = boardLayout.players[playerIndex]
  if (!playerLayout) {
    return 0
  }

  const length = boardLayout.mainTrack.length
  const direction = getBoardDirectionMultiplier()
  return ((playerLayout.startIndex + trackProgress * direction) % length + length) % length
}

function getTrackFacingYaw(playerIndex: number, trackProgress: number) {
  const playerLayout = boardLayout.players[playerIndex]
  const absoluteIndex = getAbsoluteTrackIndex(playerIndex, trackProgress)
  const trackYaw = normalizeYaw(getTrackYawForAbsoluteIndex(absoluteIndex) + MAIN_TRACK_YAW_CORRECTION + PAWN_MODEL_YAW_OFFSET)

  if (playerLayout && absoluteIndex === playerLayout.homeEntryIndex) {
    return normalizeYaw(trackYaw + Math.PI / 2)
  }

  return trackYaw
}

function getLaneDirectionVector(playerIndex: number, laneIndex: number) {
  const lane = boardLayout.players[playerIndex]?.homeLane ?? []
  const current = lane[laneIndex]
  if (!current) {
    return new THREE.Vector3(0, 0, 1)
  }

  const next = lane[laneIndex + 1]
  if (next) {
    return vecFrom(next).sub(vecFrom(current))
  }

  const previous = lane[laneIndex - 1]
  if (previous) {
    return vecFrom(current).sub(vecFrom(previous))
  }

  return new THREE.Vector3(0, 0, 1)
}

function getHomeLaneFacingYaw(playerIndex: number, laneIndex: number) {
  const baseYaw = yawFromDirection(getLaneDirectionVector(playerIndex, laneIndex))
  if (playerIndex === 0 || playerIndex === 2) {
    return normalizeYaw(baseYaw + Math.PI)
  }
  return baseYaw
}

function getFinishedFacingYaw(playerIndex: number) {
  const lane = boardLayout.players[playerIndex]?.homeLane ?? []
  if (lane.length > 0) {
    return getHomeLaneFacingYaw(playerIndex, lane.length - 1)
  }

  return PLAYER_BASE_YAWS[playerIndex] ?? 0
}

function getBaseFacingYaw(playerIndex: number) {
  return normalizeYaw((PLAYER_BASE_YAWS[playerIndex] ?? 0) + PAWN_MODEL_YAW_OFFSET)
}

function getTokenFacingYaw(token: Token, playerIndex: number) {
  if (token.state === 'in_base') {
    return getBaseFacingYaw(playerIndex)
  }

  if (token.state === 'on_track') {
    return getTrackFacingYaw(playerIndex, token.position)
  }

  if (token.state === 'in_home_lane') {
    return getHomeLaneFacingYaw(playerIndex, token.position)
  }

  return getFinishedFacingYaw(playerIndex)
}

function getMotionWaypointFacingYaw(waypoint: MotionWaypoint, playerIndex: number) {
  if (waypoint.step.state === 'in_base') {
    return getBaseFacingYaw(playerIndex)
  }

  if (waypoint.step.state === 'on_track') {
    return getTrackFacingYaw(playerIndex, waypoint.step.position)
  }

  if (waypoint.step.state === 'in_home_lane') {
    return getHomeLaneFacingYaw(playerIndex, waypoint.step.position)
  }

  return getFinishedFacingYaw(playerIndex)
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
      applyMaterialOpacity(material, opacity)
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

function motionPlanFromEvent(eventDetails: MockMoveEventDetails | undefined, playerIndex: number): MotionWaypoint[] | null {
  if (!eventDetails) {
    return null
  }

  return eventDetails.path.map((step: MockPathStep) => {
    let position = new THREE.Vector3()

    if (step.state === 'on_track') {
      position = getTrackWorldPosition(playerIndex, step.position)
    }

    if (step.state === 'in_home_lane') {
      position = getHomeLaneWorldPosition(playerIndex, step.position)
    }

    if (step.state === 'in_base') {
      position = getStableSlotWorldPosition(playerIndex, eventDetails.tokenId)
    }

    return {
      step,
      position,
    }
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
  const gradientMap = getBoardGradientMap()
  return (
    <group position={[cx, cy, cz]} rotation-y={box.rotationY ?? 0}>
      <mesh position={[0, -h * 0.12, 0]} castShadow>
        <boxGeometry args={[w * 0.9, h * 0.6, d * 0.9]} />
        <meshToonMaterial color={color} gradientMap={gradientMap} />
      </mesh>

      <mesh position={[0, h * 0.18, 0]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[w * 0.98, h * 0.2, d * 0.98]} />
        <meshToonMaterial color={roofColor} gradientMap={gradientMap} />
      </mesh>

      <mesh position={[w * 0.28, h * 0.22, -d * 0.18]} castShadow>
        <boxGeometry args={[w * 0.12, h * 0.18, d * 0.12]} />
        <meshToonMaterial color={chimneyColor} gradientMap={gradientMap} />
      </mesh>
    </group>
  )
}

function PawnInstance({
  token,
  playerIndex,
  targetX,
  targetY,
  targetZ,
  motionPlan,
  motionPlanKey,
  captureMotion,
  isSelectable,
  arrowColor,
  isHovered,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  animationDurationMs = 300,
  spawnImpact,
  moveFromState,
}: {
  token: Token
  playerIndex: number
  targetX: number
  targetY: number
  targetZ: number
  motionPlan: MotionWaypoint[] | null
  motionPlanKey: string | null
  captureMotion: CaptureMotion | null
  isSelectable: boolean
  arrowColor: string
  isHovered: boolean
  onPointerDown?: (event: any) => void
  onPointerOver?: (event: any) => void
  onPointerOut?: (event: any) => void
  animationDurationMs?: number
  spawnImpact?: SpawnImpactPuff | null
  moveFromState?: MockPathStep['state']
}) {
  const modelRef = useRef<THREE.Group | null>(null)
  const effectRef = useRef<THREE.Group | null>(null)
  const arrowRef = useRef<THREE.Mesh | null>(null)
  const arrowBaseScale = 0.40
  const queueRef = useRef<MotionWaypoint[]>([])
  const segmentStartRef = useRef(new THREE.Vector3())
  const segmentTargetRef = useRef(new THREE.Vector3())
  const segmentTargetStepRef = useRef<MockPathStep | null>(null)
  const segmentStartTimeRef = useRef<number>(-1)
  const motionKeyRef = useRef<string>('')
  const captureKeyRef = useRef<string>('')
  const captureStartTimeRef = useRef<number>(-1)
  const capturePhaseRef = useRef<'idle' | 'hit' | 'return' | 'done'>('idle')
  const segmentsLandedRef = useRef(0)
  const captureImpactFiredRef = useRef(false)
  const pawnModelPath = getPawnModelPath(playerIndex)
  const pawnScene = useGLTF(pawnModelPath).scene

  const normalizedPawn = useMemo(() => normalizePawnModel(pawnScene, { x: 0.28, y: 0.24, z: 0.28 }), [pawnScene])

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
    captureImpactFiredRef.current = false
    setOpacity(effectRef.current, 1)
  }, [captureMotion])

  useEffect(() => {
    if (!modelRef.current || captureMotion) {
      return
    }

    const settleKey = `${token.id}:${token.state}:${token.position}`

    if (!motionPlanKey || !motionPlan || motionPlan.length === 0) {
      if (motionKeyRef.current === settleKey) {
        return
      }
      motionKeyRef.current = settleKey
      queueRef.current = []
      segmentStartTimeRef.current = -1
      modelRef.current.position.set(targetX, targetY, targetZ)
      modelRef.current.rotation.y = lerpAngle(
        modelRef.current.rotation.y,
        getTokenFacingYaw(token, playerIndex),
        1,
      )
      return
    }

    if (motionKeyRef.current === motionPlanKey) {
      return
    }

    motionKeyRef.current = motionPlanKey
    segmentsLandedRef.current = 0

    queueRef.current = motionPlan.map((waypoint) => ({
      step: waypoint.step,
      position: waypoint.position.clone(),
    }))
    segmentStartRef.current.copy(modelRef.current.position)
    segmentTargetRef.current.copy(queueRef.current[0]?.position ?? new THREE.Vector3(targetX, targetY, targetZ))
    segmentTargetStepRef.current = queueRef.current[0]?.step ?? null
    segmentStartTimeRef.current = -1
  }, [captureMotion, motionPlan, motionPlanKey, targetX, targetY, targetZ, token, playerIndex])

  useFrame((state, delta) => {
    if (!modelRef.current) return

    if (captureMotion) {
      const hitDuration = 180 / 1000
      const returnDuration = 620 / 1000

      if (captureStartTimeRef.current < 0 && capturePhaseRef.current !== 'done') {
        captureStartTimeRef.current = state.clock.elapsedTime
        if (!captureImpactFiredRef.current && spawnImpact) {
          captureImpactFiredRef.current = true
          spawnImpact(captureMotion.sourcePosition, 'capture_hit', {
            tokenId: token.id,
            playerIndex,
          })
        }
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
        modelRef.current.rotation.y = lerpAngle(modelRef.current.rotation.y, getBaseFacingYaw(playerIndex), Math.min(1, delta * 10))
        return
      }

      capturePhaseRef.current = 'return'
      const returnProgress = THREE.MathUtils.clamp((elapsed - hitDuration) / returnDuration, 0, 1)
      modelRef.current.position.copy(smoothArcPosition(captureMotion.sourcePosition, captureMotion.targetPosition, returnProgress))
      modelRef.current.scale.setScalar(1 - returnProgress * 0.05)
      modelRef.current.rotation.y = lerpAngle(modelRef.current.rotation.y, getBaseFacingYaw(playerIndex), Math.min(1, delta * 10))

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
      if (!nearVector(modelRef.current.position, targetX, targetY, targetZ)) {
        modelRef.current.position.set(targetX, targetY, targetZ)
      }
      modelRef.current.rotation.y = lerpAngle(modelRef.current.rotation.y, getTokenFacingYaw(token, playerIndex), Math.min(1, delta * 10))
      if (arrowRef.current) {
        const pulse = isHovered ? 0.07 * (1 + Math.sin(state.clock.elapsedTime * 5.5)) : 0
        const scale = arrowBaseScale * (1 + pulse)
        arrowRef.current.scale.set(scale, scale, scale)
      }
      return
    }

    if (segmentStartTimeRef.current < 0) {
      segmentStartTimeRef.current = state.clock.elapsedTime
    }

    const duration = Math.max(1, animationDurationMs) / 1000
    const elapsed = state.clock.elapsedTime - segmentStartTimeRef.current
    const progress = Math.min(1, elapsed / duration)
    modelRef.current.position.copy(smoothArcPosition(segmentStartRef.current, segmentTargetRef.current, progress))
    if (segmentTargetStepRef.current) {
      modelRef.current.rotation.y = lerpAngle(
        modelRef.current.rotation.y,
        getMotionWaypointFacingYaw({ step: segmentTargetStepRef.current, position: segmentTargetRef.current }, playerIndex),
        Math.min(1, delta * 10),
      )
    }

    if (progress >= 1) {
      if (spawnImpact) {
        const landKind: ImpactPuffKind =
          segmentsLandedRef.current === 0 && moveFromState === 'in_base' ? 'spawn_exit' : 'step_land'
        spawnImpact(segmentTargetRef.current, landKind, {
          tokenId: token.id,
          playerIndex,
        })
        segmentsLandedRef.current += 1
      }

      queueRef.current.shift()

      if (queueRef.current.length === 0) {
        segmentStartTimeRef.current = -1
        if (!nearVector(modelRef.current.position, targetX, targetY, targetZ)) {
          modelRef.current.position.set(targetX, targetY, targetZ)
        }
        modelRef.current.rotation.y = lerpAngle(modelRef.current.rotation.y, getTokenFacingYaw(token, playerIndex), Math.min(1, delta * 10))
        if (arrowRef.current) {
          const pulse = isHovered ? 0.07 * (1 + Math.sin(state.clock.elapsedTime * 5.5)) : 0
          const scale = arrowBaseScale * (1 + pulse)
          arrowRef.current.scale.set(scale, scale, scale)
        }
        return
      }

      segmentStartRef.current.copy(segmentTargetRef.current)
      segmentTargetRef.current.copy(queueRef.current[0].position)
      segmentTargetStepRef.current = queueRef.current[0].step
      segmentStartTimeRef.current = state.clock.elapsedTime
    }
  })

  return (
    <group>
      <group ref={modelRef} scale={[0.92, 0.92, 0.92]}>
        <primitive object={normalizedPawn} />
        {isSelectable ? (
          <mesh
            onPointerDown={onPointerDown}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
          >
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ) : null}
        {isSelectable ? (
          <Billboard position={[0, 0.42, 0]} follow lockX={false} lockY={false} lockZ={false}>
            <mesh ref={arrowRef} scale={[arrowBaseScale, arrowBaseScale, arrowBaseScale]}>
              <shapeGeometry args={[MOVE_SELECT_TRIANGLE]} />
              <meshBasicMaterial color={arrowColor} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </Billboard>
        ) : null}
      </group>
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

export default function BoardPieces({
  gameState,
  animationDurationMs = 300,
  selectableTokenIds,
  onSelectToken,
  freezeTokenAnimations = false,
  boardImpactFeedback,
}: BoardPiecesProps) {
  const layout = boardLayout as any
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null)
  const spawnImpactRef = useRef<SpawnImpactPuff | null>(null)
  const selectableTokenSet = useMemo(() => new Set(selectableTokenIds ?? []), [selectableTokenIds])
  const versionCursorRef = useRef({ version: -1, eventCount: 0 })
  const skipHistoryAnimationRef = useRef(true)

  const deltaEvents = useMemo(() => {
    if (skipHistoryAnimationRef.current) {
      return []
    }
    if (freezeTokenAnimations) {
      return []
    }
    return getDeltaEventsSinceVersion(gameState, versionCursorRef.current)
  }, [freezeTokenAnimations, gameState.version, gameState.events])

  useLayoutEffect(() => {
    if (freezeTokenAnimations) {
      return
    }
    if (skipHistoryAnimationRef.current) {
      skipHistoryAnimationRef.current = false
      updateVersionCursor(gameState, versionCursorRef.current)
      return
    }
    updateVersionCursor(gameState, versionCursorRef.current)
  }, [freezeTokenAnimations, gameState.version, gameState.events.length])

  const playerIndexById = useMemo(() => {
    const m: Record<string, number> = {}
    gameState.players.forEach((p) => {
      m[p.id] = boardSlotForPlayer(gameState.players, p.id)
    })
    return m
  }, [gameState.players])

  const moveEventByTokenId = useMemo(
    () => extractMoveDetailsFromDelta(deltaEvents),
    [deltaEvents],
  )

  const captureMoveByCapturedTokenId = useMemo(
    () => extractCaptureDetailsFromDelta(deltaEvents),
    [deltaEvents],
  )

  const tokensWithTargets = useMemo(() => {
    return gameState.tokens.map((token) => {
      const playerIndex = playerIndexById[token.playerId] ?? 0
      const targetPosition = tokenStateToWorldPosition(token, playerIndex)
      const movePayload = moveEventByTokenId.get(token.id)
      const motionPlan = movePayload
        ? motionPlanFromEvent(movePayload.details, playerIndex)
        : null
      const motionPlanKey = movePayload
        ? `${token.id}:move:${gameState.version}:${movePayload.timestamp}:${movePayload.details.path.length}`
        : null
      const moveFromState = movePayload?.details.from.state
      const captureMotion = token.state === 'in_base'
        ? captureMotionFromEvent(captureMoveByCapturedTokenId.get(token.id), playerIndexById, token)
        : null
      const isSelectable = selectableTokenSet.has(token.id)
      const isHovered = isSelectable && hoveredTokenId === token.id
      const arrowColor = isHovered ? '#22d3ee' : '#f8fafc'

      return {
        token,
        playerIndex,
        targetX: targetPosition.x,
        targetY: targetPosition.y,
        targetZ: targetPosition.z,
        motionPlan,
        motionPlanKey,
        moveFromState,
        captureMotion,
        isSelectable,
        arrowColor,
      }
    })
  }, [
    captureMoveByCapturedTokenId,
    gameState.tokens,
    gameState.version,
    hoveredTokenId,
    moveEventByTokenId,
    playerIndexById,
    selectableTokenSet,
  ])

  return (
    <group>
      <ImpactPuffPool
        feedback={boardImpactFeedback}
        onSpawnReady={(spawn) => {
          spawnImpactRef.current = spawn
        }}
      />

      {/* Houses */}
      {gameState.players.map((p) => {
        const slot = boardSlotForPlayer(gameState.players, p.id)
        const home = layout.players?.[slot]?.home ?? null
        return <HousePlaceholder key={`house-${p.id}`} box={home} color={PLAYER_COLOR_HEX[p.color] ?? '#ddd'} />
      })}

      {/* Pawns */}
      {tokensWithTargets.map(({ token, playerIndex, targetX, targetY, targetZ, motionPlan, motionPlanKey, moveFromState, captureMotion, isSelectable, arrowColor }) => (
        <group key={token.id}>
          <PawnInstance
            token={token}
            playerIndex={playerIndex}
            targetX={targetX}
            targetY={targetY}
            targetZ={targetZ}
            motionPlan={motionPlan}
            motionPlanKey={motionPlanKey}
            captureMotion={captureMotion}
            isSelectable={isSelectable}
            arrowColor={arrowColor}
            isHovered={isSelectable && hoveredTokenId === token.id}
            spawnImpact={freezeTokenAnimations ? null : spawnImpactRef.current}
            moveFromState={moveFromState}
            onPointerDown={(event) => {
              if (!isSelectable || !onSelectToken) {
                return
              }
              event.stopPropagation()
              onSelectToken(token.id)
            }}
            onPointerOver={(event) => {
              if (!isSelectable) {
                return
              }
              event.stopPropagation()
              setHoveredTokenId(token.id)
            }}
            onPointerOut={(event) => {
              if (!isSelectable) {
                return
              }
              event.stopPropagation()
              setHoveredTokenId((current) => (current === token.id ? null : current))
            }}
            animationDurationMs={animationDurationMs}
          />
        </group>
      ))}
    </group>
  )
}
