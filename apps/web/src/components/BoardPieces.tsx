import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Line, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { GameState, Token } from '@rune-race/shared'
import boardLayout from '../../data/board-layout.json'
import { boardSlotForPlayer } from '../utils/boardSlots'
import {
  extractCaptureDetailsFromDelta,
  extractMoveDetailsFromDelta,
  extractSentHomeDetailsFromDelta,
  extractShieldConsumedFromDelta,
  extractShieldGrantedFromDelta,
  extractFreezeAppliedFromDelta,
  extractFreezeExpiredFromDelta,
  extractSwapDetailsFromDelta,
  getDeltaEventsSinceVersion,
  updateVersionCursor,
  type CaptureEventDetails,
  type MoveAnimationPayload,
  type SentHomeAnimationPayload,
  type SentHomeEventDetails,
  type ShieldConsumedPayload,
  type ShieldGrantedPayload,
  type FreezeAppliedPayload,
  type FreezeExpiredPayload,
  splitPathAtStep,
  splitPathForShieldGrantAndConsume,
  stepsEqual,
  type SwapEventDetails,
  type SwapTokenStep,
} from '../lib/tokenMotion'
import type { ImpactPuffKind } from '../lib/boardImpact'
import ImpactPuffPool, { type SpawnImpactPuff } from './board/ImpactPuffPool'
import type { BoardImpactFeedback } from '../lib/boardImpact'
import { useRuneMarkerVisibility } from '../contexts/RuneMarkerVisibilityContext'
import { applyMaterialOpacity, getBoardGradientMap } from '../lib/sceneMaterials'
import type { GraphicsQuality } from '../lib/graphicsQuality'
import { getGraphicsQualityFlags } from '../lib/graphicsQuality'
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

/** Shield icon — height aligned with move selector triangle. */
const SHIELD_ICON_SHAPE = (() => {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.15)
  shape.lineTo(0.12, 0.06)
  shape.lineTo(0.1, -0.1)
  shape.quadraticCurveTo(0, -0.17, -0.1, -0.1)
  shape.lineTo(-0.12, 0.06)
  shape.closePath()
  return shape
})()

const SHIELD_SHARD_SHAPES = [
  (() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.12, 0.06)
    shape.lineTo(0, 0.15)
    shape.lineTo(0, -0.02)
    shape.lineTo(-0.1, -0.1)
    shape.closePath()
    return shape
  })(),
  (() => {
    const shape = new THREE.Shape()
    shape.moveTo(0.12, 0.06)
    shape.lineTo(0, 0.15)
    shape.lineTo(0, -0.02)
    shape.lineTo(0.1, -0.1)
    shape.closePath()
    return shape
  })(),
  (() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.09, -0.04)
    shape.lineTo(0.09, -0.04)
    shape.lineTo(0, -0.17)
    shape.closePath()
    return shape
  })(),
] as const

const SHIELD_SHARD_VELOCITIES = [
  new THREE.Vector3(-0.14, 0.1, 0.04),
  new THREE.Vector3(0.14, 0.1, -0.04),
  new THREE.Vector3(0, -0.12, 0.02),
] as const

type ShieldBreakMotion = {
  key: string
  billboardY: number
}

type FreezeApplyMotion = {
  key: string
  billboardY: number
}

type FreezeExpireMotion = {
  key: string
  billboardY: number
}

type ShieldGrantMotion = {
  key: string
  billboardY: number
}

const SHIELD_SPARK_OFFSETS = [
  new THREE.Vector3(0.12, 0.05, 0),
  new THREE.Vector3(-0.1, 0.07, 0),
  new THREE.Vector3(0.04, 0.13, 0),
  new THREE.Vector3(-0.05, -0.11, 0),
  new THREE.Vector3(0.1, -0.07, 0),
  new THREE.Vector3(-0.11, -0.02, 0),
]

const ICE_SHARD_OFFSETS = [
  new THREE.Vector3(0.14, 0.04, 0),
  new THREE.Vector3(-0.12, 0.06, 0),
  new THREE.Vector3(0.05, 0.14, 0),
  new THREE.Vector3(-0.06, -0.12, 0),
  new THREE.Vector3(0.11, -0.08, 0),
  new THREE.Vector3(-0.13, -0.03, 0),
]

const ICE_SHARD_VELOCITIES = ICE_SHARD_OFFSETS.map(
  (offset) => new THREE.Vector3(offset.x * 1.15, offset.y * 1.15, offset.z),
)

/** Snowflake-style 6-point star — sized to match move selector bounds. */
const FREEZE_ICON_SHAPE = (() => {
  const shape = new THREE.Shape()
  const points = 12
  const outer = 0.12
  const inner = 0.048
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 2
    const radius = i % 2 === 0 ? outer : inner
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
})()

interface BoardPiecesProps {
  gameState: GameState
  animationDurationMs?: number
  selectableTokenIds?: string[]
  onSelectToken?: (tokenId: string) => void
  /** Visual hint for why tokens are selectable. */
  tokenSelectionMode?: 'move' | 'swap'
  /** Quân vừa kích hoạt Hoán vị — dùng cho đường nối tới ứng viên. */
  swapActivatorTokenId?: string | null
  swapPreviewTokenIds?: string[]
  swapChoiceTargetIds?: string[]
  /** Local player may confirm a swap target click. */
  swapSelectionEnabled?: boolean
  /** Hold token motion until dice presentation finishes. */
  freezeTokenAnimations?: boolean
  /** SFX / reduced-motion hooks (see lib/boardImpact.ts). */
  boardImpactFeedback?: BoardImpactFeedback
  graphicsQuality?: GraphicsQuality
  shadowsEnabled?: boolean
}

type CaptureMotion = {
  key: string
  sourcePosition: THREE.Vector3
  targetPosition: THREE.Vector3
}

type SwapMotion = {
  key: string
  sourcePosition: THREE.Vector3
  targetPosition: THREE.Vector3
}

type SegmentPauseKind = 'shield_grant' | 'shield_break' | 'freeze_apply' | null

type ActiveMoveSession = {
  baseKey: string
  paths: MockPathStep[][]
  segmentIndex: number
  /** Pause after segment `i` completes. Length matches `paths`. */
  pauseAfterSegment: SegmentPauseKind[]
  /** Show shield break before the first segment starts. */
  pauseBeforeMove: boolean
  shieldBreakKey: string | null
  shieldGrantKey: string | null
  freezeApplyKey: string | null
  shieldBreakComplete: boolean
  shieldGrantComplete: boolean
  freezeApplyComplete: boolean
  awaitingShieldBreak: boolean
  awaitingShieldGrant: boolean
  awaitingFreezeApply: boolean
}

type MotionWaypoint = {
  step: MockPathStep
  position: THREE.Vector3
  motion?: 'step' | 'teleport'
  arcLift?: number
  /** Y offset at segment start — 0 = board, >0 = standing on another pawn's head. */
  arcStartElevation?: number
  /** Y offset at segment end — 0 = board, >0 = standing on another pawn's head. */
  arcEndElevation?: number
}

const PAWN_DISPLAY_SCALE = 0.92

/** Shared accent palette with move / swap selectors. */
const TOKEN_ACCENT_CYAN = '#22d3ee'
const TOKEN_ACCENT_SLATE = '#f8fafc'
const MOVE_SELECTOR_SCALE = 0.4
const MOVE_SELECTOR_Y = 0.42
const MOVE_SELECTOR_TOP_Y = MOVE_SELECTOR_Y + MOVE_SELECTOR_SCALE * 0.08
/** Full visual height of the move selector triangle at current scale. */
const MOVE_SELECTOR_HEIGHT = MOVE_SELECTOR_SCALE * 0.23
/** Vertical step between stacked status icons (~one selector height). */
const STATUS_ICON_STEP = MOVE_SELECTOR_SCALE * 0.24

function statusBillboardY(isSelectable: boolean, stackIndex: number): number {
  if (isSelectable) {
    // Clear the selector body, then stack additional status icons above.
    return MOVE_SELECTOR_TOP_Y + MOVE_SELECTOR_HEIGHT * 0.35 + STATUS_ICON_STEP * (1 + stackIndex)
  }
  if (stackIndex <= 0) {
    return MOVE_SELECTOR_Y
  }
  return MOVE_SELECTOR_Y + STATUS_ICON_STEP * stackIndex
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

function smoothArcPosition(start: THREE.Vector3, end: THREE.Vector3, progress: number, lift = 0.24) {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1)
  const lifted = Math.sin(Math.PI * clamped)
  const position = new THREE.Vector3().lerpVectors(start, end, clamped)
  position.y += lifted * lift
  return position
}

/** Normal step arc — same lift for every hop. */
const BASE_STEP_ARC_LIFT = 0.24
/** Feet height when landing on another pawn's head (model height × display scale). */
const PAWN_HEAD_LANDING_HEIGHT = 0.24 * PAWN_DISPLAY_SCALE
const OBSTACLE_CELL_RADIUS = 0.15

function nearXZ(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  return Math.hypot(a.x - b.x, a.z - b.z) < radius
}

function elevationAtPoint(point: THREE.Vector3, obstaclePositions: THREE.Vector3[]) {
  for (const obstacle of obstaclePositions) {
    if (nearXZ(obstacle, point, OBSTACLE_CELL_RADIUS)) {
      return PAWN_HEAD_LANDING_HEIGHT
    }
  }
  return 0
}

/** Same hop as a normal step, but endpoints can sit on another pawn's head instead of the board. */
function smoothStepArcPosition(
  start: THREE.Vector3,
  end: THREE.Vector3,
  progress: number,
  lift: number,
  startElevation = 0,
  endElevation = 0,
) {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1)
  const position = new THREE.Vector3().lerpVectors(start, end, clamped)
  const baseY = THREE.MathUtils.lerp(start.y + startElevation, end.y + endElevation, clamped)
  position.y = baseY + Math.sin(Math.PI * clamped) * lift
  return position
}

function applyArcLiftsToWaypoints(
  waypoints: MotionWaypoint[],
  segmentStart: THREE.Vector3,
  obstaclePositions: THREE.Vector3[],
): MotionWaypoint[] {
  let previous = segmentStart
  return waypoints.map((waypoint) => {
    if (waypoint.motion === 'teleport') {
      return { ...waypoint, arcLift: BASE_STEP_ARC_LIFT, arcStartElevation: 0, arcEndElevation: 0 }
    }

    const arcStartElevation = elevationAtPoint(previous, obstaclePositions)
    const arcEndElevation = elevationAtPoint(waypoint.position, obstaclePositions)
    previous = waypoint.position
    return {
      ...waypoint,
      arcLift: BASE_STEP_ARC_LIFT,
      arcStartElevation,
      arcEndElevation,
    }
  })
}

function swapArcPosition(start: THREE.Vector3, end: THREE.Vector3, progress: number) {
  return smoothArcPosition(start, end, progress, 0.42)
}

type RuneTeleportFrame = {
  position: THREE.Vector3
  scaleMul: number
  opacity: number
}

/** Rune advance/back: shrink into ground at origin, hidden travel, burst up at destination. */
function runeTeleportMotion(start: THREE.Vector3, end: THREE.Vector3, progress: number): RuneTeleportFrame {
  const t = THREE.MathUtils.clamp(progress, 0, 1)
  const buryDepth = 0.5
  const smooth = (x: number) => x * x * (3 - 2 * x)
  const easeIn = (x: number) => x * x
  const easeOut = (x: number) => 1 - (1 - x) * (1 - x)

  const SINK_END = 0.34
  const HIDDEN_END = 0.5

  if (t < SINK_END) {
    const p = smooth(t / SINK_END)
    const position = start.clone()
    position.y -= buryDepth * easeIn(p)
    const scaleMul = Math.max(0, 1 - p)
    const opacity = 1 - smooth(Math.max(0, (p - 0.45) / 0.55))
    return { position, scaleMul, opacity }
  }

  if (t < HIDDEN_END) {
    const position = start.clone()
    position.y -= buryDepth
    return { position, scaleMul: 0, opacity: 0 }
  }

  const p = smooth((t - HIDDEN_END) / (1 - HIDDEN_END))
  const position = end.clone()
  position.y -= buryDepth * (1 - easeOut(p))
  if (p > 0.82) {
    const bounce = Math.sin(((p - 0.82) / 0.18) * Math.PI) * 0.05
    position.y += bounce
  }

  const scaleMul = easeOut(p)
  const opacity = Math.min(1, p * 1.35)
  return { position, scaleMul, opacity }
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

function ShieldBreakBillboard({
  motion,
  spawnImpact,
  tokenId,
  playerIndex,
}: {
  motion: ShieldBreakMotion
  spawnImpact?: SpawnImpactPuff | null
  tokenId: string
  playerIndex: number
}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const mainRef = useRef<THREE.Mesh | null>(null)
  const shardRefs = useRef<Array<THREE.Mesh | null>>([null, null, null])
  const motionKeyRef = useRef('')
  const startTimeRef = useRef(-1)
  const impactFiredRef = useRef(false)
  const phaseRef = useRef<'shake' | 'shatter' | 'done'>('shake')

  useEffect(() => {
    if (motionKeyRef.current === motion.key) return
    motionKeyRef.current = motion.key
    startTimeRef.current = -1
    impactFiredRef.current = false
    phaseRef.current = 'shake'
    if (mainRef.current) {
      mainRef.current.visible = true
      mainRef.current.rotation.z = 0
      mainRef.current.position.set(0, 0, 0)
      setOpacity(mainRef.current, 0.95)
    }
    shardRefs.current.forEach((shard) => {
      if (!shard) return
      shard.visible = false
      shard.position.set(0, 0, 0)
      shard.rotation.z = 0
      setOpacity(shard, 0.95)
    })
  }, [motion.key])

  useFrame((state) => {
    if (phaseRef.current === 'done') return

    if (startTimeRef.current < 0) {
      startTimeRef.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current
    const shakeEnd = 0.16
    const shatterEnd = 0.62
    const fadeEnd = 0.88

    if (elapsed < shakeEnd) {
      const wobble = Math.sin(elapsed * 90) * (1 - elapsed / shakeEnd)
      if (mainRef.current) {
        mainRef.current.rotation.z = wobble * 0.22
        mainRef.current.position.x = wobble * 0.025
        mainRef.current.position.y = Math.abs(Math.sin(elapsed * 110)) * 0.012
      }
      return
    }

    if (elapsed < shatterEnd) {
      if (phaseRef.current === 'shake') {
        phaseRef.current = 'shatter'
        if (mainRef.current) {
          mainRef.current.visible = false
        }
        shardRefs.current.forEach((shard) => {
          if (shard) shard.visible = true
        })
        if (!impactFiredRef.current && spawnImpact && groupRef.current) {
          impactFiredRef.current = true
          const worldPos = new THREE.Vector3()
          groupRef.current.getWorldPosition(worldPos)
          spawnImpact(worldPos, 'capture_hit', { tokenId, playerIndex })
        }
      }

      const shatterProgress = THREE.MathUtils.clamp((elapsed - shakeEnd) / (shatterEnd - shakeEnd), 0, 1)
      shardRefs.current.forEach((shard, index) => {
        if (!shard) return
        const velocity = SHIELD_SHARD_VELOCITIES[index] ?? SHIELD_SHARD_VELOCITIES[0]
        shard.position.set(
          velocity.x * shatterProgress,
          velocity.y * shatterProgress,
          velocity.z * shatterProgress,
        )
        shard.rotation.z = shatterProgress * (index % 2 === 0 ? 1.4 : -1.4)
      })
      return
    }

    if (elapsed < fadeEnd) {
      const fadeProgress = THREE.MathUtils.clamp((elapsed - shatterEnd) / (fadeEnd - shatterEnd), 0, 1)
      const opacity = 0.95 * (1 - fadeProgress)
      shardRefs.current.forEach((shard, index) => {
        if (!shard) return
        const velocity = SHIELD_SHARD_VELOCITIES[index] ?? SHIELD_SHARD_VELOCITIES[0]
        const extra = fadeProgress * 0.06
        shard.position.set(
          velocity.x * (1 + extra),
          velocity.y * (1 + extra),
          velocity.z * (1 + extra),
        )
        setOpacity(shard, opacity)
      })
      return
    }

    phaseRef.current = 'done'
    shardRefs.current.forEach((shard) => {
      if (shard) shard.visible = false
    })
  })

  return (
    <Billboard position={[0, motion.billboardY, 0]} follow lockX={false} lockY={false} lockZ={false}>
      <group ref={groupRef} scale={[MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE]}>
        <mesh ref={mainRef}>
          <shapeGeometry args={[SHIELD_ICON_SHAPE]} />
          <meshBasicMaterial
            color={TOKEN_ACCENT_SLATE}
            transparent
            opacity={0.95}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {SHIELD_SHARD_SHAPES.map((shardShape, index) => (
          <mesh key={`shard-${index}`} ref={(node) => { shardRefs.current[index] = node }} visible={false}>
            <shapeGeometry args={[shardShape]} />
            <meshBasicMaterial
              color={TOKEN_ACCENT_SLATE}
              transparent
              opacity={0.95}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </Billboard>
  )
}

function FreezeApplyBillboard({
  motion,
  spawnImpact,
  tokenId,
  playerIndex,
}: {
  motion: FreezeApplyMotion
  spawnImpact?: SpawnImpactPuff | null
  tokenId: string
  playerIndex: number
}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const snowflakeRef = useRef<THREE.Mesh | null>(null)
  const ringRef = useRef<THREE.Mesh | null>(null)
  const shardRefs = useRef<Array<THREE.Mesh | null>>([null, null, null, null, null, null])
  const motionKeyRef = useRef('')
  const startTimeRef = useRef(-1)
  const impactFiredRef = useRef(false)
  const phaseRef = useRef<'pop' | 'burst' | 'settle' | 'done'>('pop')

  useEffect(() => {
    if (motionKeyRef.current === motion.key) return
    motionKeyRef.current = motion.key
    startTimeRef.current = -1
    impactFiredRef.current = false
    phaseRef.current = 'pop'
    if (snowflakeRef.current) {
      snowflakeRef.current.visible = true
      snowflakeRef.current.rotation.z = 0
      snowflakeRef.current.scale.setScalar(0.2)
      setOpacity(snowflakeRef.current, 0.95)
    }
    if (ringRef.current) {
      ringRef.current.visible = false
      ringRef.current.scale.setScalar(0.35)
      setOpacity(ringRef.current, 0.75)
    }
    shardRefs.current.forEach((shard) => {
      if (!shard) return
      shard.visible = false
      shard.position.set(0, 0, 0)
      shard.rotation.z = 0
      setOpacity(shard, 0.9)
    })
  }, [motion.key])

  useFrame((state) => {
    if (phaseRef.current === 'done') return

    if (startTimeRef.current < 0) {
      startTimeRef.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current
    const popEnd = 0.2
    const burstEnd = 0.58
    const settleEnd = 0.88

    if (elapsed < popEnd) {
      const t = THREE.MathUtils.clamp(elapsed / popEnd, 0, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const scale = 0.2 + ease * 0.95
      if (snowflakeRef.current) {
        snowflakeRef.current.scale.setScalar(scale)
        snowflakeRef.current.rotation.z = t * Math.PI * 0.35
      }
      return
    }

    if (elapsed < burstEnd) {
      if (phaseRef.current === 'pop') {
        phaseRef.current = 'burst'
        if (ringRef.current) {
          ringRef.current.visible = true
        }
        shardRefs.current.forEach((shard, index) => {
          if (!shard) return
          shard.visible = true
          const offset = ICE_SHARD_OFFSETS[index] ?? ICE_SHARD_OFFSETS[0]
          shard.position.copy(offset)
        })
        if (!impactFiredRef.current && spawnImpact && groupRef.current) {
          impactFiredRef.current = true
          const worldPos = new THREE.Vector3()
          groupRef.current.getWorldPosition(worldPos)
          spawnImpact(worldPos, 'capture_hit', { tokenId, playerIndex })
        }
      }

      const burstProgress = THREE.MathUtils.clamp((elapsed - popEnd) / (burstEnd - popEnd), 0, 1)
      if (ringRef.current) {
        ringRef.current.scale.setScalar(0.35 + burstProgress * 1.45)
        setOpacity(ringRef.current, 0.75 * (1 - burstProgress * 0.85))
      }
      shardRefs.current.forEach((shard, index) => {
        if (!shard) return
        const offset = ICE_SHARD_OFFSETS[index] ?? ICE_SHARD_OFFSETS[0]
        const pull = 1 - burstProgress * 0.82
        shard.position.set(offset.x * pull, offset.y * pull, offset.z)
        shard.rotation.z = (1 - burstProgress) * (index % 2 === 0 ? 0.8 : -0.8)
        setOpacity(shard, 0.9 * (1 - burstProgress * 0.7))
      })
      if (snowflakeRef.current) {
        snowflakeRef.current.scale.setScalar(1.15 + Math.sin(burstProgress * Math.PI) * 0.08)
      }
      return
    }

    if (elapsed < settleEnd) {
      if (phaseRef.current === 'burst') {
        phaseRef.current = 'settle'
        if (ringRef.current) {
          ringRef.current.visible = false
        }
        shardRefs.current.forEach((shard) => {
          if (shard) shard.visible = false
        })
      }

      const settleProgress = THREE.MathUtils.clamp((elapsed - burstEnd) / (settleEnd - burstEnd), 0, 1)
      if (snowflakeRef.current) {
        const bob = Math.sin(elapsed * 8) * 0.012 * (1 - settleProgress)
        snowflakeRef.current.position.y = bob
        snowflakeRef.current.scale.setScalar(1.08 - settleProgress * 0.08)
        setOpacity(snowflakeRef.current, 0.95 * (1 - settleProgress * 0.35))
      }
      return
    }

    phaseRef.current = 'done'
    if (snowflakeRef.current) {
      snowflakeRef.current.visible = false
      snowflakeRef.current.position.y = 0
    }
  })

  return (
    <Billboard position={[0, motion.billboardY, 0]} follow lockX={false} lockY={false} lockZ={false}>
      <group ref={groupRef} scale={[MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE]}>
        <mesh ref={ringRef} visible={false}>
          <ringGeometry args={[0.1, 0.13, 24]} />
          <meshBasicMaterial
            color="#a5f3fc"
            transparent
            opacity={0.75}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {ICE_SHARD_OFFSETS.map((_, index) => (
          <mesh
            key={`ice-shard-${index}`}
            ref={(node) => {
              shardRefs.current[index] = node
            }}
            visible={false}
          >
            <circleGeometry args={[0.022, 6]} />
            <meshBasicMaterial
              color="#67e8f9"
              transparent
              opacity={0.9}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        <mesh ref={snowflakeRef}>
          <shapeGeometry args={[FREEZE_ICON_SHAPE]} />
          <meshBasicMaterial
            color={TOKEN_ACCENT_CYAN}
            transparent
            opacity={0.95}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </Billboard>
  )
}

function FreezeExpireBillboard({
  motion,
  spawnImpact,
  tokenId,
  playerIndex,
}: {
  motion: FreezeExpireMotion
  spawnImpact?: SpawnImpactPuff | null
  tokenId: string
  playerIndex: number
}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const snowflakeRef = useRef<THREE.Mesh | null>(null)
  const ringRef = useRef<THREE.Mesh | null>(null)
  const shardRefs = useRef<Array<THREE.Mesh | null>>([null, null, null, null, null, null])
  const motionKeyRef = useRef('')
  const startTimeRef = useRef(-1)
  const impactFiredRef = useRef(false)
  const phaseRef = useRef<'crack' | 'shatter' | 'fade' | 'done'>('crack')

  useEffect(() => {
    if (motionKeyRef.current === motion.key) return
    motionKeyRef.current = motion.key
    startTimeRef.current = -1
    impactFiredRef.current = false
    phaseRef.current = 'crack'
    if (snowflakeRef.current) {
      snowflakeRef.current.visible = true
      snowflakeRef.current.rotation.z = 0
      snowflakeRef.current.position.set(0, 0, 0)
      snowflakeRef.current.scale.setScalar(1)
      setOpacity(snowflakeRef.current, 0.95)
    }
    if (ringRef.current) {
      ringRef.current.visible = false
      ringRef.current.scale.setScalar(0.35)
      setOpacity(ringRef.current, 0.75)
    }
    shardRefs.current.forEach((shard) => {
      if (!shard) return
      shard.visible = false
      shard.position.set(0, 0, 0)
      shard.rotation.z = 0
      setOpacity(shard, 0.9)
    })
  }, [motion.key])

  useFrame((state) => {
    if (phaseRef.current === 'done') return

    if (startTimeRef.current < 0) {
      startTimeRef.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current
    const crackEnd = 0.18
    const shatterEnd = 0.58
    const fadeEnd = 0.88

    if (elapsed < crackEnd) {
      const t = THREE.MathUtils.clamp(elapsed / crackEnd, 0, 1)
      const wobble = Math.sin(elapsed * 88) * (1 - t * 0.35)
      if (snowflakeRef.current) {
        snowflakeRef.current.rotation.z = wobble * 0.28
        snowflakeRef.current.position.x = wobble * 0.02
        snowflakeRef.current.position.y = Math.abs(Math.sin(elapsed * 104)) * 0.012
        snowflakeRef.current.scale.setScalar(1 + Math.sin(elapsed * 18) * 0.04)
      }
      return
    }

    if (elapsed < shatterEnd) {
      if (phaseRef.current === 'crack') {
        phaseRef.current = 'shatter'
        if (snowflakeRef.current) {
          snowflakeRef.current.visible = false
        }
        if (ringRef.current) {
          ringRef.current.visible = true
        }
        shardRefs.current.forEach((shard) => {
          if (shard) shard.visible = true
        })
        if (!impactFiredRef.current && spawnImpact && groupRef.current) {
          impactFiredRef.current = true
          const worldPos = new THREE.Vector3()
          groupRef.current.getWorldPosition(worldPos)
          spawnImpact(worldPos, 'step_land', { tokenId, playerIndex })
        }
      }

      const shatterProgress = THREE.MathUtils.clamp((elapsed - crackEnd) / (shatterEnd - crackEnd), 0, 1)
      if (ringRef.current) {
        ringRef.current.scale.setScalar(0.35 + shatterProgress * 1.35)
        setOpacity(ringRef.current, 0.75 * (1 - shatterProgress * 0.9))
      }
      shardRefs.current.forEach((shard, index) => {
        if (!shard) return
        const velocity = ICE_SHARD_VELOCITIES[index] ?? ICE_SHARD_VELOCITIES[0]
        shard.position.set(
          velocity.x * shatterProgress,
          velocity.y * shatterProgress,
          velocity.z * shatterProgress,
        )
        shard.rotation.z = shatterProgress * (index % 2 === 0 ? 1.6 : -1.6)
        setOpacity(shard, 0.9 * (1 - shatterProgress * 0.35))
      })
      return
    }

    if (elapsed < fadeEnd) {
      if (phaseRef.current === 'shatter') {
        phaseRef.current = 'fade'
        if (ringRef.current) {
          ringRef.current.visible = false
        }
      }

      const fadeProgress = THREE.MathUtils.clamp((elapsed - shatterEnd) / (fadeEnd - shatterEnd), 0, 1)
      shardRefs.current.forEach((shard, index) => {
        if (!shard) return
        const velocity = ICE_SHARD_VELOCITIES[index] ?? ICE_SHARD_VELOCITIES[0]
        const extra = fadeProgress * 0.08
        shard.position.set(
          velocity.x * (1 + extra),
          velocity.y * (1 + extra),
          velocity.z * (1 + extra),
        )
        setOpacity(shard, 0.58 * (1 - fadeProgress))
      })
      return
    }

    phaseRef.current = 'done'
    shardRefs.current.forEach((shard) => {
      if (shard) shard.visible = false
    })
    if (snowflakeRef.current) {
      snowflakeRef.current.visible = false
      snowflakeRef.current.position.set(0, 0, 0)
      snowflakeRef.current.rotation.z = 0
    }
  })

  return (
    <Billboard position={[0, motion.billboardY, 0]} follow lockX={false} lockY={false} lockZ={false}>
      <group ref={groupRef} scale={[MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE]}>
        <mesh ref={ringRef} visible={false}>
          <ringGeometry args={[0.1, 0.13, 24]} />
          <meshBasicMaterial
            color="#a5f3fc"
            transparent
            opacity={0.75}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {ICE_SHARD_OFFSETS.map((_, index) => (
          <mesh
            key={`ice-expire-shard-${index}`}
            ref={(node) => {
              shardRefs.current[index] = node
            }}
            visible={false}
          >
            <circleGeometry args={[0.022, 6]} />
            <meshBasicMaterial
              color="#67e8f9"
              transparent
              opacity={0.9}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        <mesh ref={snowflakeRef} key={`freeze-expire-${motion.key}`}>
          <shapeGeometry args={[FREEZE_ICON_SHAPE]} />
          <meshBasicMaterial
            color={TOKEN_ACCENT_CYAN}
            transparent
            opacity={0.95}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </Billboard>
  )
}

function ShieldGrantBillboard({
  motion,
  spawnImpact,
  tokenId,
  playerIndex,
}: {
  motion: ShieldGrantMotion
  spawnImpact?: SpawnImpactPuff | null
  tokenId: string
  playerIndex: number
}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const shieldRef = useRef<THREE.Mesh | null>(null)
  const ringRef = useRef<THREE.Mesh | null>(null)
  const sparkRefs = useRef<Array<THREE.Mesh | null>>([null, null, null, null, null, null])
  const motionKeyRef = useRef('')
  const startTimeRef = useRef(-1)
  const impactFiredRef = useRef(false)
  const phaseRef = useRef<'pop' | 'burst' | 'settle' | 'done'>('pop')

  useEffect(() => {
    if (motionKeyRef.current === motion.key) return
    motionKeyRef.current = motion.key
    startTimeRef.current = -1
    impactFiredRef.current = false
    phaseRef.current = 'pop'
    if (shieldRef.current) {
      shieldRef.current.visible = true
      shieldRef.current.rotation.z = 0
      shieldRef.current.scale.setScalar(0.18)
      setOpacity(shieldRef.current, 0.95)
    }
    if (ringRef.current) {
      ringRef.current.visible = false
      ringRef.current.scale.setScalar(0.3)
      setOpacity(ringRef.current, 0.8)
    }
    sparkRefs.current.forEach((spark) => {
      if (!spark) return
      spark.visible = false
      spark.position.set(0, 0, 0)
      setOpacity(spark, 0.92)
    })
  }, [motion.key])

  useFrame((state) => {
    if (phaseRef.current === 'done') return

    if (startTimeRef.current < 0) {
      startTimeRef.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current
    const popEnd = 0.2
    const burstEnd = 0.58
    const settleEnd = 0.88

    if (elapsed < popEnd) {
      const t = THREE.MathUtils.clamp(elapsed / popEnd, 0, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      if (shieldRef.current) {
        shieldRef.current.scale.setScalar(0.18 + ease * 0.92)
        shieldRef.current.rotation.z = -t * Math.PI * 0.2
      }
      return
    }

    if (elapsed < burstEnd) {
      if (phaseRef.current === 'pop') {
        phaseRef.current = 'burst'
        if (ringRef.current) {
          ringRef.current.visible = true
        }
        sparkRefs.current.forEach((spark) => {
          if (spark) spark.visible = true
        })
        if (!impactFiredRef.current && spawnImpact && groupRef.current) {
          impactFiredRef.current = true
          const worldPos = new THREE.Vector3()
          groupRef.current.getWorldPosition(worldPos)
          spawnImpact(worldPos, 'capture_hit', { tokenId, playerIndex })
        }
      }

      const burstProgress = THREE.MathUtils.clamp((elapsed - popEnd) / (burstEnd - popEnd), 0, 1)
      if (ringRef.current) {
        ringRef.current.scale.setScalar(0.3 + burstProgress * 1.5)
        setOpacity(ringRef.current, 0.8 * (1 - burstProgress * 0.88))
      }
      sparkRefs.current.forEach((spark, index) => {
        if (!spark) return
        const offset = SHIELD_SPARK_OFFSETS[index] ?? SHIELD_SPARK_OFFSETS[0]
        spark.position.set(offset.x * burstProgress, offset.y * burstProgress, offset.z)
        setOpacity(spark, 0.92 * (1 - burstProgress * 0.75))
      })
      if (shieldRef.current) {
        shieldRef.current.scale.setScalar(1.08 + Math.sin(burstProgress * Math.PI) * 0.1)
        shieldRef.current.rotation.z = -Math.PI * 0.2 * (1 - burstProgress)
      }
      return
    }

    if (elapsed < settleEnd) {
      if (phaseRef.current === 'burst') {
        phaseRef.current = 'settle'
        if (ringRef.current) {
          ringRef.current.visible = false
        }
        sparkRefs.current.forEach((spark) => {
          if (spark) spark.visible = false
        })
        if (shieldRef.current) {
          shieldRef.current.rotation.z = 0
        }
      }

      const settleProgress = THREE.MathUtils.clamp((elapsed - burstEnd) / (settleEnd - burstEnd), 0, 1)
      if (shieldRef.current) {
        const bob = Math.sin(elapsed * 7) * 0.01 * (1 - settleProgress)
        shieldRef.current.position.y = bob
        shieldRef.current.scale.setScalar(1.08 - settleProgress * 0.08)
        shieldRef.current.rotation.z = 0
        setOpacity(shieldRef.current, 0.95 * (1 - settleProgress * 0.3))
      }
      return
    }

    phaseRef.current = 'done'
    if (shieldRef.current) {
      shieldRef.current.visible = false
      shieldRef.current.position.y = 0
      shieldRef.current.rotation.z = 0
    }
  })

  return (
    <Billboard position={[0, motion.billboardY, 0]} follow lockX={false} lockY={false} lockZ={false}>
      <group ref={groupRef} scale={[MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE]}>
        <mesh ref={ringRef} visible={false}>
          <ringGeometry args={[0.1, 0.13, 24]} />
          <meshBasicMaterial
            color="#fde68a"
            transparent
            opacity={0.8}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {SHIELD_SPARK_OFFSETS.map((_, index) => (
          <mesh
            key={`shield-spark-${index}`}
            ref={(node) => {
              sparkRefs.current[index] = node
            }}
            visible={false}
          >
            <circleGeometry args={[0.018, 6]} />
            <meshBasicMaterial
              color="#fbbf24"
              transparent
              opacity={0.92}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        <mesh ref={shieldRef} key={`shield-grant-${motion.key}`}>
          <shapeGeometry args={[SHIELD_ICON_SHAPE]} />
          <meshBasicMaterial
            color={TOKEN_ACCENT_SLATE}
            transparent
            opacity={0.95}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </Billboard>
  )
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

function collapseTeleportBursts(waypoints: MotionWaypoint[]): MotionWaypoint[] {
  const collapsed: MotionWaypoint[] = []
  let index = 0

  while (index < waypoints.length) {
    const waypoint = waypoints[index]
    if (waypoint.motion !== 'teleport') {
      collapsed.push(waypoint)
      index += 1
      continue
    }

    let end = index
    while (end + 1 < waypoints.length && waypoints[end + 1].motion === 'teleport') {
      end += 1
    }
    let maxLift = waypoints[index].arcLift ?? BASE_STEP_ARC_LIFT
    for (let cursor = index + 1; cursor <= end; cursor += 1) {
      maxLift = Math.max(maxLift, waypoints[cursor].arcLift ?? BASE_STEP_ARC_LIFT)
    }
    collapsed.push({ ...waypoints[end], arcLift: maxLift, arcStartElevation: 0, arcEndElevation: 0 })
    index = end + 1
  }

  return collapsed
}

function worldPositionForTokenStep(
  tokenId: string,
  playerIndex: number,
  step: MockPathStep,
): THREE.Vector3 {
  if (step.state === 'on_track') {
    return getTrackWorldPosition(playerIndex, step.position)
  }
  if (step.state === 'in_home_lane') {
    return getHomeLaneWorldPosition(playerIndex, step.position)
  }
  if (step.state === 'in_base') {
    return getStableSlotWorldPosition(playerIndex, tokenId)
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

function motionPlanFromPathSteps(
  path: MockPathStep[],
  tokenId: string,
  playerIndex: number,
  options?: {
    segmentStart?: THREE.Vector3
    obstaclePositions?: THREE.Vector3[]
  },
): MotionWaypoint[] | null {
  if (path.length === 0) {
    return null
  }

  const waypoints = path.map((step: MockPathStep) => {
    let position = new THREE.Vector3()

    if (step.state === 'on_track') {
      position = getTrackWorldPosition(playerIndex, step.position)
    }

    if (step.state === 'in_home_lane') {
      position = getHomeLaneWorldPosition(playerIndex, step.position)
    }

    if (step.state === 'in_base') {
      position = getStableSlotWorldPosition(playerIndex, tokenId)
    }

    return {
      step,
      position,
      motion: step.motion === 'teleport' ? 'teleport' : 'step',
    }
  })

  let collapsed = collapseTeleportBursts(waypoints)
  if (options?.segmentStart && options.obstaclePositions) {
    collapsed = applyArcLiftsToWaypoints(collapsed, options.segmentStart, options.obstaclePositions)
  }
  return collapsed
}

function motionPlanFromEvent(eventDetails: MockMoveEventDetails | undefined, playerIndex: number): MotionWaypoint[] | null {
  if (!eventDetails) {
    return null
  }
  return motionPlanFromPathSteps(eventDetails.path, eventDetails.tokenId, playerIndex)
}

function isSegmentPausePending(session: ActiveMoveSession): boolean {
  const pauseKind = session.pauseAfterSegment[session.segmentIndex]
  if (pauseKind === 'shield_grant' && !session.shieldGrantComplete) return true
  if (pauseKind === 'shield_break' && !session.shieldBreakComplete) return true
  if (pauseKind === 'freeze_apply' && !session.freezeApplyComplete) return true
  return false
}

function statusEffectStepMatches(
  at: SwapTokenStep | undefined,
  step: MockPathStep,
  movePayload?: MoveAnimationPayload,
): boolean {
  if (!at) return true
  if (stepsEqual(at, step)) return true
  const lastStep = movePayload?.details.path.at(-1)
  if (lastStep && stepsEqual(step, lastStep)) return true
  return false
}

function buildMoveSession(
  movePayload: MoveAnimationPayload,
  rawMotionPlanKey: string,
  shieldConsumed: ShieldConsumedPayload | undefined,
  shieldGranted: ShieldGrantedPayload | undefined,
  freezeApplied: FreezeAppliedPayload | undefined,
): ActiveMoveSession | null {
  const path = movePayload.details.path
  if (path.length === 0) {
    return null
  }

  const emptySessionFlags = {
    shieldBreakComplete: false,
    shieldGrantComplete: false,
    freezeApplyComplete: false,
    awaitingShieldBreak: false,
    awaitingShieldGrant: false,
    awaitingFreezeApply: false,
    freezeApplyKey: null as string | null,
    segmentIndex: 0,
  }

  if (shieldGranted?.at && shieldConsumed?.at) {
    const grantAndConsume = splitPathForShieldGrantAndConsume(
      path,
      shieldGranted.at,
      shieldConsumed.at,
    )
    if (grantAndConsume) {
      return {
        baseKey: rawMotionPlanKey,
        paths: grantAndConsume.paths,
        pauseAfterSegment: grantAndConsume.pauseAfterSegment,
        pauseBeforeMove: false,
        shieldBreakKey: shieldConsumed.key,
        shieldGrantKey: shieldGranted.key,
        ...emptySessionFlags,
      }
    }
  }

  if (shieldGranted?.at && !shieldConsumed) {
    const grantSplit = splitPathAtStep(path, shieldGranted.at)
    if (grantSplit) {
      const paths =
        grantSplit.after.length > 0 ? [grantSplit.before, grantSplit.after] : [grantSplit.before]
      const pauseAfterSegment: SegmentPauseKind[] = paths.map((_, index) =>
        index === 0 ? 'shield_grant' : null,
      )
      return {
        baseKey: rawMotionPlanKey,
        paths,
        pauseAfterSegment,
        pauseBeforeMove: false,
        shieldBreakKey: null,
        shieldGrantKey: shieldGranted.key,
        ...emptySessionFlags,
      }
    }
  }

  const consumeSplit = shieldConsumed?.at ? splitPathAtStep(path, shieldConsumed.at) : null
  if (consumeSplit) {
    const paths =
      consumeSplit.after.length > 0 ? [consumeSplit.before, consumeSplit.after] : [consumeSplit.before]
    const pauseAfterSegment: SegmentPauseKind[] = paths.map((_, index) =>
      index === 0 ? 'shield_break' : null,
    )
    return {
      baseKey: rawMotionPlanKey,
      paths,
      pauseAfterSegment,
      pauseBeforeMove: false,
      shieldBreakKey: shieldConsumed?.key ?? null,
      shieldGrantKey: null,
      ...emptySessionFlags,
    }
  }

  if (shieldConsumed) {
    return {
      baseKey: rawMotionPlanKey,
      paths: [path],
      pauseAfterSegment: [null],
      pauseBeforeMove: true,
      shieldBreakKey: shieldConsumed.key,
      shieldGrantKey: null,
      ...emptySessionFlags,
    }
  }

  if (freezeApplied) {
    const freezeAt = freezeApplied.at ?? path[path.length - 1]
    const freezeSplit = freezeAt ? splitPathAtStep(path, freezeAt) : null
    if (freezeSplit) {
      const paths =
        freezeSplit.after.length > 0 ? [freezeSplit.before, freezeSplit.after] : [freezeSplit.before]
      const pauseAfterSegment: SegmentPauseKind[] = paths.map((_, index) =>
        index === 0 ? 'freeze_apply' : null,
      )
      return {
        baseKey: rawMotionPlanKey,
        paths,
        pauseAfterSegment,
        pauseBeforeMove: false,
        shieldBreakKey: null,
        shieldGrantKey: null,
        freezeApplyKey: freezeApplied.key,
        ...emptySessionFlags,
      }
    }

    return {
      baseKey: rawMotionPlanKey,
      paths: [path],
      pauseAfterSegment: ['freeze_apply'],
      pauseBeforeMove: false,
      shieldBreakKey: null,
      shieldGrantKey: null,
      freezeApplyKey: freezeApplied.key,
      ...emptySessionFlags,
    }
  }

  return {
    baseKey: rawMotionPlanKey,
    paths: [path],
    pauseAfterSegment: [null],
    pauseBeforeMove: false,
    shieldBreakKey: null,
    shieldGrantKey: null,
    ...emptySessionFlags,
  }
}

function buildRawMotionPlanKey(tokenId: string, movePayload: MoveAnimationPayload) {
  return `${tokenId}:move:${movePayload.timestamp}:${movePayload.details.path.length}`
}

function extractMotionBaseKey(motionPlanKey: string): string {
  const segmentMarker = ':seg:'
  const segmentIndex = motionPlanKey.indexOf(segmentMarker)
  return segmentIndex >= 0 ? motionPlanKey.slice(0, segmentIndex) : motionPlanKey
}

function isTokenMoveAnimationPending(
  tokenId: string,
  movePayload: MoveAnimationPayload | undefined,
  activeMoveSessions: Map<string, ActiveMoveSession>,
  consumedMotionKeys: Set<string>,
): boolean {
  const session = activeMoveSessions.get(tokenId)
  if (session && !consumedMotionKeys.has(session.baseKey)) {
    return true
  }
  if (movePayload) {
    const path = movePayload.details.path
    if (!Array.isArray(path) || path.length === 0) {
      return false
    }
    const rawKey = buildRawMotionPlanKey(tokenId, movePayload)
    if (!consumedMotionKeys.has(rawKey)) {
      return true
    }
  }
  return false
}

function resolveSwapVisualPosition(
  token: Token,
  playerIndex: number,
  statePosition: THREE.Vector3,
  latchedSwap: LatchedSwapAnimation | null,
  consumedSwapKeys: Set<string>,
  swapMotion: SwapMotion | null,
): THREE.Vector3 {
  if (!latchedSwap || consumedSwapKeys.has(latchedSwap.key)) {
    return statePosition
  }

  // Swap flight / settle uses post-swap state once motion begins.
  if (swapMotion) {
    return statePosition
  }

  const { details } = latchedSwap
  if (token.id === details.targetTokenId) {
    return worldPositionFromStep(playerIndex, token.id, details.targetFrom)
  }

  if (token.id === details.activatorTokenId) {
    return worldPositionFromStep(playerIndex, token.id, details.activatorFrom)
  }

  return statePosition
}

type LatchedSwapAnimation = {
  key: string
  details: SwapEventDetails
  timestamp: number
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
    sourcePosition: worldPositionFromStep(moverIndex, eventDetails.tokenId, eventDetails.from),
    targetPosition: getStableSlotWorldPositionForSlot(targetPlayerIndex, eventDetails.to.position),
  }
}

function sentHomeMotionFromEvent(
  payload: SentHomeAnimationPayload | undefined,
  playerIndex: number,
  token: Token,
): CaptureMotion | null {
  if (!payload?.details.from || !payload.details.to) {
    return null
  }

  return {
    key: payload.key,
    sourcePosition: worldPositionFromStep(playerIndex, token.id, payload.details.from),
    targetPosition: getStableSlotWorldPositionForSlot(playerIndex, payload.details.to.position),
  }
}

function worldPositionFromStep(
  playerIndex: number,
  tokenId: string,
  step: SwapTokenStep,
): THREE.Vector3 {
  if (step.state === 'on_track') {
    return getTrackWorldPosition(playerIndex, step.position)
  }
  if (step.state === 'in_home_lane') {
    return getHomeLaneWorldPosition(playerIndex, step.position)
  }
  if (step.state === 'in_base') {
    const slotMatch = tokenId.match(/:(\d+)$/)
    const slot = slotMatch ? Number(slotMatch[1]) : 0
    return getStableSlotWorldPositionForSlot(playerIndex, slot)
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

function swapMotionForToken(
  swapDetails: SwapEventDetails,
  token: Token,
  playerIndex: number,
  timestamp: number,
): SwapMotion | null {
  const isActivator = token.id === swapDetails.activatorTokenId
  const isTarget = token.id === swapDetails.targetTokenId
  if (!isActivator && !isTarget) {
    return null
  }

  const from = isActivator ? swapDetails.activatorFrom : swapDetails.targetFrom
  const to = isActivator ? swapDetails.activatorTo : swapDetails.targetTo

  return {
    key: `${swapDetails.activatorTokenId}:${swapDetails.targetTokenId}:${timestamp}`,
    sourcePosition: worldPositionFromStep(playerIndex, token.id, from),
    targetPosition: worldPositionFromStep(playerIndex, token.id, to),
  }
}

function SwapChoiceGuides({
  gameState,
  playerIndexById,
  activatorTokenId,
  selectableTokenIds,
}: {
  gameState: GameState
  playerIndexById: Record<string, number>
  activatorTokenId: string
  selectableTokenIds: string[]
}) {
  const activator = gameState.tokens.find((token) => token.id === activatorTokenId)
  if (!activator) {
    return null
  }

  const activatorIndex = playerIndexById[activator.playerId] ?? 0
  const activatorPosition = tokenStateToWorldPosition(activator, activatorIndex)

  return (
    <group>
      {selectableTokenIds.map((tokenId) => {
        const target = gameState.tokens.find((token) => token.id === tokenId)
        if (!target) {
          return null
        }
        const targetIndex = playerIndexById[target.playerId] ?? 0
        const targetPosition = tokenStateToWorldPosition(target, targetIndex)
        const points: [number, number, number][] = [
          [activatorPosition.x, activatorPosition.y + 0.08, activatorPosition.z],
          [
            (activatorPosition.x + targetPosition.x) / 2,
            Math.max(activatorPosition.y, targetPosition.y) + 0.35,
            (activatorPosition.z + targetPosition.z) / 2,
          ],
          [targetPosition.x, targetPosition.y + 0.08, targetPosition.z],
        ]

        return (
          <Line
            key={`swap-guide-${tokenId}`}
            points={points}
            color="#c084fc"
            lineWidth={1.5}
            dashed
            dashSize={0.08}
            gapSize={0.05}
            transparent
            opacity={0.72}
          />
        )
      })}
    </group>
  )
}

function SwapExchangeArc({
  gameState,
  swapDetails,
  playerIndexById,
}: {
  gameState: GameState
  swapDetails: SwapEventDetails
  playerIndexById: Record<string, number>
}) {
  const startRef = useRef(-1)
  const [progress, setProgress] = useState(0)

  useFrame((state) => {
    if (startRef.current < 0) {
      startRef.current = state.clock.elapsedTime
    }
    const next = THREE.MathUtils.clamp((state.clock.elapsedTime - startRef.current) / 0.9, 0, 1)
    setProgress(next)
  })

  return (
    <SwapExchangeArcLine
      gameState={gameState}
      swapDetails={swapDetails}
      playerIndexById={playerIndexById}
      progress={progress}
    />
  )
}

function SwapExchangeArcLine({
  gameState,
  swapDetails,
  playerIndexById,
  progress,
}: {
  gameState: GameState
  swapDetails: SwapEventDetails
  playerIndexById: Record<string, number>
  progress: number
}) {
  const activator = gameState.tokens.find((t) => t.id === swapDetails.activatorTokenId)
  const target = gameState.tokens.find((t) => t.id === swapDetails.targetTokenId)
  if (!activator || !target) {
    return null
  }

  const activatorIndex = playerIndexById[activator.playerId] ?? 0
  const targetIndex = playerIndexById[target.playerId] ?? 0

  const activatorFrom = worldPositionFromStep(
    activatorIndex,
    swapDetails.activatorTokenId,
    swapDetails.activatorFrom,
  )
  const activatorTo = worldPositionFromStep(
    activatorIndex,
    swapDetails.activatorTokenId,
    swapDetails.activatorTo,
  )
  const targetFrom = worldPositionFromStep(
    targetIndex,
    swapDetails.targetTokenId,
    swapDetails.targetFrom,
  )
  const targetTo = worldPositionFromStep(
    targetIndex,
    swapDetails.targetTokenId,
    swapDetails.targetTo,
  )

  const activatorCurrent = swapArcPosition(activatorFrom, activatorTo, progress)
  const targetCurrent = swapArcPosition(targetFrom, targetTo, progress)
  const points: [number, number, number][] = [
    [activatorCurrent.x, activatorCurrent.y + 0.05, activatorCurrent.z],
    [
      (activatorCurrent.x + targetCurrent.x) / 2,
      Math.max(activatorCurrent.y, targetCurrent.y) + 0.28,
      (activatorCurrent.z + targetCurrent.z) / 2,
    ],
    [targetCurrent.x, targetCurrent.y + 0.05, targetCurrent.z],
  ]

  return (
    <Line
      points={points}
      color="#e879f9"
      lineWidth={2.4}
      transparent
      opacity={0.85 * (1 - Math.abs(progress - 0.5) * 0.35)}
    />
  )
}

function HousePlaceholder({
  box,
  color = '#ffffff',
  cartoonMaterials = true,
  basicMaterials = false,
  castShadow = true,
}: {
  box: any
  color?: string
  cartoonMaterials?: boolean
  basicMaterials?: boolean
  castShadow?: boolean
}) {
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
  const gradientMap = cartoonMaterials ? getBoardGradientMap() : undefined

  const BaseMat = cartoonMaterials ? (
    <meshToonMaterial color={color} gradientMap={gradientMap} />
  ) : basicMaterials ? (
    <meshBasicMaterial color={color} />
  ) : (
    <meshLambertMaterial color={color} />
  )
  const RoofMat = cartoonMaterials ? (
    <meshToonMaterial color={roofColor} gradientMap={gradientMap} />
  ) : basicMaterials ? (
    <meshBasicMaterial color={roofColor} />
  ) : (
    <meshLambertMaterial color={roofColor} />
  )
  const ChimneyMat = cartoonMaterials ? (
    <meshToonMaterial color={chimneyColor} gradientMap={gradientMap} />
  ) : basicMaterials ? (
    <meshBasicMaterial color={chimneyColor} />
  ) : (
    <meshLambertMaterial color={chimneyColor} />
  )

  return (
    <group position={[cx, cy, cz]} rotation-y={box.rotationY ?? 0}>
      <mesh position={[0, -h * 0.12, 0]} castShadow={castShadow}>
        <boxGeometry args={[w * 0.9, h * 0.6, d * 0.9]} />
        {BaseMat}
      </mesh>

      <mesh position={[0, h * 0.18, 0]} rotation={[0, 0, 0]} castShadow={castShadow}>
        <boxGeometry args={[w * 0.98, h * 0.2, d * 0.98]} />
        {RoofMat}
      </mesh>

      <mesh position={[w * 0.28, h * 0.22, -d * 0.18]} castShadow={castShadow}>
        <boxGeometry args={[w * 0.12, h * 0.18, d * 0.12]} />
        {ChimneyMat}
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
  swapMotion,
  swapPreviewSpin = false,
  shieldBreakMotion = null,
  shieldGrantMotion = null,
  freezeApplyMotion = null,
  freezeExpireMotion = null,
  showFrozenStatusIcon = false,
  suppressFrozenStatusIcon = false,
  suppressShieldStatusIcon = false,
  moveAnimationHold = false,
  isFinalMoveSegment = true,
  pendingMoveAnimation = false,
  isSelectable,
  isSwapChoiceTarget = false,
  selectionMode = 'move',
  arrowColor,
  isHovered,
  onPointerDown,
  onPointerOver,
  onPointerOut,
  animationDurationMs = 300,
  spawnImpact,
  moveFromState,
  motionOriginWorld = null,
  onMoveAnimationDone,
  onMoveSegmentComplete,
  onMoveStepLanded,
  cartoonMaterials = true,
  basicMaterials = false,
  reduceMeshDetail = false,
  castShadow = true,
}: {
  token: Token
  playerIndex: number
  targetX: number
  targetY: number
  targetZ: number
  motionPlan: MotionWaypoint[] | null
  motionPlanKey: string | null
  captureMotion: CaptureMotion | null
  swapMotion: SwapMotion | null
  swapPreviewSpin?: boolean
  shieldBreakMotion?: ShieldBreakMotion | null
  shieldGrantMotion?: ShieldGrantMotion | null
  freezeApplyMotion?: FreezeApplyMotion | null
  freezeExpireMotion?: FreezeExpireMotion | null
  /** Keep snowflake visible until expire shatter animation starts. */
  showFrozenStatusIcon?: boolean
  /** Hide the idle freeze icon until the apply animation has finished. */
  suppressFrozenStatusIcon?: boolean
  /** Hide the idle shield icon until the grant animation has finished. */
  suppressShieldStatusIcon?: boolean
  moveAnimationHold?: boolean
  isFinalMoveSegment?: boolean
  pendingMoveAnimation?: boolean
  isSelectable: boolean
  isSwapChoiceTarget?: boolean
  selectionMode?: 'move' | 'swap'
  arrowColor: string
  isHovered: boolean
  onPointerDown?: (event: any) => void
  onPointerOver?: (event: any) => void
  onPointerOut?: (event: any) => void
  animationDurationMs?: number
  spawnImpact?: SpawnImpactPuff | null
  moveFromState?: MockPathStep['state']
  motionOriginWorld?: THREE.Vector3 | null
  onMoveAnimationDone?: (motionPlanKey: string) => void
  onMoveSegmentComplete?: (motionPlanKey: string) => void
  onMoveStepLanded?: (step: MockPathStep, worldX: number, worldZ: number) => void
  cartoonMaterials?: boolean
  basicMaterials?: boolean
  reduceMeshDetail?: boolean
  castShadow?: boolean
}) {
  const pickSphereSegments = reduceMeshDetail ? 8 : 16
  const modelRef = useRef<THREE.Group | null>(null)
  const effectRef = useRef<THREE.Group | null>(null)
  const arrowRef = useRef<THREE.Mesh | null>(null)
  const arrowBaseScale = MOVE_SELECTOR_SCALE
  const queueRef = useRef<MotionWaypoint[]>([])
  const segmentStartRef = useRef(new THREE.Vector3())
  const segmentTargetRef = useRef(new THREE.Vector3())
  const segmentTargetStepRef = useRef<MockPathStep | null>(null)
  const segmentStartTimeRef = useRef<number>(-1)
  const motionKeyRef = useRef<string>('')
  const captureKeyRef = useRef<string>('')
  const captureStartTimeRef = useRef<number>(-1)
  const capturePhaseRef = useRef<'idle' | 'hit' | 'return' | 'done'>('idle')
  const swapKeyRef = useRef<string>('')
  const swapStartTimeRef = useRef<number>(-1)
  const swapPhaseRef = useRef<'idle' | 'flight' | 'done'>('idle')
  const swapImpactFiredRef = useRef(false)
  const swapPreviewWasSpinningRef = useRef(false)
  const segmentsLandedRef = useRef(0)
  const captureImpactFiredRef = useRef(false)
  const statusIconRef = useRef<THREE.Mesh | null>(null)
  const shieldIconRef = useRef<THREE.Mesh | null>(null)
  const moveBaseKeyRef = useRef<string | null>(null)
  const onMoveAnimationDoneRef = useRef(onMoveAnimationDone)
  const onMoveSegmentCompleteRef = useRef(onMoveSegmentComplete)
  const onMoveStepLandedRef = useRef(onMoveStepLanded)
  onMoveAnimationDoneRef.current = onMoveAnimationDone
  onMoveSegmentCompleteRef.current = onMoveSegmentComplete
  onMoveStepLandedRef.current = onMoveStepLanded

  const isMoveAnimationActive = () =>
    queueRef.current.length > 0 || segmentStartTimeRef.current >= 0

  const settleKey = `${token.id}:${token.state}:${token.position}`
  const pawnModelPath = getPawnModelPath(playerIndex)
  const pawnScene = useGLTF(pawnModelPath).scene

  const normalizedPawn = useMemo(
    () =>
      normalizePawnModel(pawnScene, {
        targetSize: { x: 0.28, y: 0.24, z: 0.28 },
        castShadow,
        cartoonMaterials,
        basicMaterials,
      }),
    [pawnScene, castShadow, cartoonMaterials, basicMaterials],
  )

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
    if (!modelRef.current || !swapMotion) return
    try {
      modelRef.current.position.copy(swapMotion.sourcePosition)
      modelRef.current.scale.setScalar(1)
    } catch {
      // ignore if model not ready
    }
  }, [swapMotion?.key])

  useEffect(() => {
    if (!swapMotion) {
      swapKeyRef.current = ''
      swapStartTimeRef.current = -1
      swapPhaseRef.current = 'idle'
      swapImpactFiredRef.current = false
      return
    }

    if (swapKeyRef.current === swapMotion.key) {
      return
    }

    swapKeyRef.current = swapMotion.key
    swapStartTimeRef.current = -1
    swapPhaseRef.current = 'flight'
    swapImpactFiredRef.current = false
    if (effectRef.current) {
      setOpacity(effectRef.current, 1)
    }
  }, [swapMotion])

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
    queueRef.current = []
    segmentStartTimeRef.current = -1
    setOpacity(effectRef.current, 1)
  }, [captureMotion])

  useEffect(() => {
    if (!modelRef.current || captureMotion || swapMotion || moveAnimationHold) {
      return
    }

    if (!motionPlanKey || !motionPlan || motionPlan.length === 0) {
      if (isMoveAnimationActive()) {
        return
      }
      if (pendingMoveAnimation) {
        return
      }
      if (motionKeyRef.current === settleKey) {
        return
      }
      motionKeyRef.current = settleKey
      queueRef.current = []
      segmentStartTimeRef.current = -1
      modelRef.current.position.set(targetX, targetY, targetZ)
      if (token.state === 'on_track') {
        onMoveStepLandedRef.current?.(
          { state: token.state, position: token.position },
          targetX,
          targetZ,
        )
      }
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
      motion: waypoint.motion ?? 'step',
      arcLift: waypoint.arcLift,
      arcStartElevation: waypoint.arcStartElevation ?? 0,
      arcEndElevation: waypoint.arcEndElevation ?? 0,
    }))

    const baseKey = extractMotionBaseKey(motionPlanKey)
    const isNewBaseMove = moveBaseKeyRef.current !== baseKey
    if (isNewBaseMove) {
      moveBaseKeyRef.current = baseKey
      if (motionOriginWorld) {
        modelRef.current.position.copy(motionOriginWorld)
      } else if (moveFromState === 'in_base') {
        modelRef.current.position.copy(getStableSlotWorldPosition(playerIndex, token.id))
      }
    }

    segmentStartRef.current.copy(modelRef.current.position)
    segmentTargetRef.current.copy(queueRef.current[0]?.position ?? new THREE.Vector3(targetX, targetY, targetZ))
    segmentTargetStepRef.current = queueRef.current[0]?.step ?? null
    segmentStartTimeRef.current = -1
  }, [captureMotion, swapMotion, moveAnimationHold, motionPlan, motionPlanKey, motionOriginWorld, moveFromState, pendingMoveAnimation, targetX, targetY, targetZ, token, playerIndex, settleKey])

  const isAnimatingMove = () =>
    queueRef.current.length > 0 || segmentStartTimeRef.current >= 0

  useFrame((state, delta) => {
    if (!modelRef.current) return

    const isFrozen = token.state !== 'in_base' && (token.freezeTurnsRemaining ?? 0) > 0
    const statusPulse = (phase: number) =>
      MOVE_SELECTOR_SCALE * (1 + Math.sin(state.clock.elapsedTime * phase) * 0.07)
    if (statusIconRef.current) {
      statusIconRef.current.rotation.z = 0
      const bob = isFrozen ? Math.sin(state.clock.elapsedTime * 3.2) * 0.008 : 0
      statusIconRef.current.position.y = bob
      statusIconRef.current.scale.setScalar(statusPulse(4.5))
    }
    if (shieldIconRef.current && token.hasShield && !suppressShieldStatusIcon) {
      shieldIconRef.current.rotation.z = 0
      const bob = Math.sin(state.clock.elapsedTime * 2.8) * 0.008
      shieldIconRef.current.position.y = bob
      shieldIconRef.current.scale.setScalar(statusPulse(3.6))
    }

    if (swapMotion) {
      if (queueRef.current.length > 0 || segmentStartTimeRef.current >= 0) {
        // Let the approach move finish before playing swap flight.
      } else {
      const duration = 900 / 1000
      if (swapStartTimeRef.current < 0 && swapPhaseRef.current !== 'done') {
        swapStartTimeRef.current = state.clock.elapsedTime
      }

      const elapsed = state.clock.elapsedTime - swapStartTimeRef.current
      const progress = THREE.MathUtils.clamp(elapsed / duration, 0, 1)

      if (effectRef.current) {
        effectRef.current.position.copy(
          swapArcPosition(swapMotion.sourcePosition, swapMotion.targetPosition, progress),
        )
        const pulse = 0.55 + Math.sin(state.clock.elapsedTime * 14) * 0.12
        effectRef.current.scale.setScalar(pulse)
        setOpacity(effectRef.current, 0.55 + Math.sin(progress * Math.PI) * 0.35)
      }

      modelRef.current.position.copy(
        swapArcPosition(swapMotion.sourcePosition, swapMotion.targetPosition, progress),
      )
      modelRef.current.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.08)
      const swapTargetYaw = getTokenFacingYaw(token, playerIndex)
      modelRef.current.rotation.y = lerpAngle(
        modelRef.current.rotation.y,
        swapTargetYaw,
        Math.min(1, delta * (progress >= 1 ? 14 : 8)),
      )

      if (progress >= 1) {
        modelRef.current.position.copy(swapMotion.targetPosition)
        modelRef.current.scale.setScalar(1)
        modelRef.current.rotation.y = swapTargetYaw
        swapPhaseRef.current = 'done'
        if (!swapImpactFiredRef.current && spawnImpact) {
          swapImpactFiredRef.current = true
          spawnImpact(swapMotion.targetPosition, 'step_land', {
            tokenId: token.id,
            playerIndex,
          })
        }
        if (effectRef.current) {
          setOpacity(effectRef.current, 0)
        }
      }
      return
      }
    }

    if (swapPreviewSpin) {
      if (queueRef.current.length > 0 || segmentStartTimeRef.current >= 0) {
        // Finish move animation before swap-choice preview spin.
      } else {
      swapPreviewWasSpinningRef.current = true
      if (!nearVector(modelRef.current.position, targetX, targetY, targetZ)) {
        modelRef.current.position.set(targetX, targetY, targetZ)
      }
      modelRef.current.rotation.y += delta * 4.8
      if (arrowRef.current) {
        arrowRef.current.scale.set(arrowBaseScale, arrowBaseScale, arrowBaseScale)
      }
      return
      }
    }

    if (swapPreviewWasSpinningRef.current) {
      swapPreviewWasSpinningRef.current = false
      modelRef.current.rotation.y = getTokenFacingYaw(token, playerIndex)
    }

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

    if (moveAnimationHold) {
      return
    }

    if (queueRef.current.length === 0) {
      if (isAnimatingMove()) {
        return
      }
      if (pendingMoveAnimation) {
        return
      }
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

    const segmentMotion = queueRef.current[0]?.motion ?? 'step'
    const durationMs = segmentMotion === 'teleport' ? animationDurationMs * 2.5 : animationDurationMs
    const duration = Math.max(1, durationMs) / 1000
    const elapsed = state.clock.elapsedTime - segmentStartTimeRef.current
    const progress = Math.min(1, elapsed / duration)

    if (segmentMotion === 'teleport') {
      const { position, scaleMul, opacity } = runeTeleportMotion(
        segmentStartRef.current,
        segmentTargetRef.current,
        progress,
      )
      modelRef.current.position.copy(position)
      modelRef.current.scale.setScalar(PAWN_DISPLAY_SCALE * scaleMul)
      setOpacity(modelRef.current, opacity)
    } else {
      const segmentWaypoint = queueRef.current[0]
      modelRef.current.position.copy(
        smoothStepArcPosition(
          segmentStartRef.current,
          segmentTargetRef.current,
          progress,
          segmentWaypoint?.arcLift ?? BASE_STEP_ARC_LIFT,
          segmentWaypoint?.arcStartElevation ?? 0,
          segmentWaypoint?.arcEndElevation ?? 0,
        ),
      )
      modelRef.current.scale.setScalar(PAWN_DISPLAY_SCALE)
      setOpacity(modelRef.current, 1)
    }

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

      if (segmentTargetStepRef.current) {
        onMoveStepLandedRef.current?.(
          segmentTargetStepRef.current,
          segmentTargetRef.current.x,
          segmentTargetRef.current.z,
        )
      }

      queueRef.current.shift()

      if (queueRef.current.length === 0) {
        segmentStartTimeRef.current = -1
        const finishedKey = motionKeyRef.current
        if (!isFinalMoveSegment) {
          if (finishedKey) {
            onMoveSegmentCompleteRef.current?.(finishedKey)
          }
          if (arrowRef.current) {
            const pulse = isHovered ? 0.07 * (1 + Math.sin(state.clock.elapsedTime * 5.5)) : 0
            const scale = arrowBaseScale * (1 + pulse)
            arrowRef.current.scale.set(scale, scale, scale)
          }
          return
        }
        motionKeyRef.current = settleKey
        modelRef.current.scale.setScalar(PAWN_DISPLAY_SCALE)
        setOpacity(modelRef.current, 1)
        modelRef.current.rotation.y = lerpAngle(modelRef.current.rotation.y, getTokenFacingYaw(token, playerIndex), Math.min(1, delta * 10))
        if (finishedKey && finishedKey !== settleKey) {
          onMoveAnimationDoneRef.current?.(finishedKey)
        }
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

  const isFrozen = token.state !== 'in_base' && (token.freezeTurnsRemaining ?? 0) > 0
  const shieldStackIndex = isFrozen ? 1 : 0

  return (
    <group>
      <group ref={modelRef} scale={[PAWN_DISPLAY_SCALE, PAWN_DISPLAY_SCALE, PAWN_DISPLAY_SCALE]}>
        <primitive object={normalizedPawn} />
        {isSelectable || isSwapChoiceTarget ? (
          <mesh
            onPointerDown={onPointerDown}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
          >
            <sphereGeometry args={[0.24, pickSphereSegments, pickSphereSegments]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ) : null}
        {isSelectable || isSwapChoiceTarget ? (
          <Billboard position={[0, MOVE_SELECTOR_Y, 0]} follow lockX={false} lockY={false} lockZ={false}>
            <mesh ref={arrowRef} scale={[arrowBaseScale, arrowBaseScale, arrowBaseScale]}>
              <shapeGeometry args={[MOVE_SELECT_TRIANGLE]} />
              <meshBasicMaterial
                color={selectionMode === 'swap' ? '#e879f9' : arrowColor}
                transparent
                opacity={0.95}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </Billboard>
        ) : null}
        {token.hasShield && !shieldBreakMotion && !shieldGrantMotion && !suppressShieldStatusIcon ? (
          <Billboard
            position={[0, statusBillboardY(isSelectable, shieldStackIndex), 0]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <mesh
              key="shield-idle"
              ref={shieldIconRef}
              scale={[MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE]}
            >
              <shapeGeometry args={[SHIELD_ICON_SHAPE]} />
              <meshBasicMaterial
                color={TOKEN_ACCENT_SLATE}
                transparent
                opacity={0.95}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </Billboard>
        ) : null}
        {shieldGrantMotion ? (
          <ShieldGrantBillboard
            motion={shieldGrantMotion}
            spawnImpact={spawnImpact}
            tokenId={token.id}
            playerIndex={playerIndex}
          />
        ) : null}
        {shieldBreakMotion ? (
          <ShieldBreakBillboard
            motion={shieldBreakMotion}
            spawnImpact={spawnImpact}
            tokenId={token.id}
            playerIndex={playerIndex}
          />
        ) : null}
        {freezeApplyMotion ? (
          <FreezeApplyBillboard
            motion={freezeApplyMotion}
            spawnImpact={spawnImpact}
            tokenId={token.id}
            playerIndex={playerIndex}
          />
        ) : null}
        {freezeExpireMotion ? (
          <FreezeExpireBillboard
            motion={freezeExpireMotion}
            spawnImpact={spawnImpact}
            tokenId={token.id}
            playerIndex={playerIndex}
          />
        ) : null}
        {showFrozenStatusIcon ? (
          <Billboard
            position={[0, statusBillboardY(isSelectable, 0), 0]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <mesh
              key="freeze-idle"
              ref={statusIconRef}
              scale={[MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE, MOVE_SELECTOR_SCALE]}
            >
              <shapeGeometry args={[FREEZE_ICON_SHAPE]} />
              <meshBasicMaterial
                color={TOKEN_ACCENT_CYAN}
                transparent
                opacity={0.95}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </Billboard>
        ) : null}
      </group>
      <group ref={effectRef} visible={Boolean(captureMotion || swapMotion)}>
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial
            color={swapMotion ? '#e879f9' : '#e5e7eb'}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.05, swapMotion ? 0.18 : 0.14, 24]} />
          <meshBasicMaterial
            color={swapMotion ? '#f0abfc' : '#ffffff'}
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
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
  tokenSelectionMode = 'move',
  swapActivatorTokenId = null,
  swapPreviewTokenIds,
  swapChoiceTargetIds,
  swapSelectionEnabled = false,
  freezeTokenAnimations = false,
  boardImpactFeedback,
  graphicsQuality = 'high',
  shadowsEnabled = true,
}: BoardPiecesProps) {
  const markerVisibility = useRuneMarkerVisibility()
  const { cartoonMaterials, basicMaterials, reduceMeshDetail } =
    getGraphicsQualityFlags(graphicsQuality)
  const layout = boardLayout as any
  const [activeSwapArcKey, setActiveSwapArcKey] = useState<string | null>(null)
  const [shieldBreakRevision, setShieldBreakRevision] = useState(0)
  const [shieldGrantRevision, setShieldGrantRevision] = useState(0)
  const [freezeApplyRevision, setFreezeApplyRevision] = useState(0)
  const [freezeExpireRevision, setFreezeExpireRevision] = useState(0)
  const [sentHomeRevision, setSentHomeRevision] = useState(0)
  const [moveOrchestrationRevision, setMoveOrchestrationRevision] = useState(0)
  const [swapDeferRevision, setSwapDeferRevision] = useState(0)
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null)
  const spawnImpactRef = useRef<SpawnImpactPuff | null>(null)
  const latchedSwapRef = useRef<LatchedSwapAnimation | null>(null)
  const latchedMoveByTokenIdRef = useRef(new Map<string, MoveAnimationPayload>())
  const selectableTokenSet = useMemo(() => new Set(selectableTokenIds ?? []), [selectableTokenIds])
  const swapPreviewTokenSet = useMemo(() => new Set(swapPreviewTokenIds ?? []), [swapPreviewTokenIds])
  const swapChoiceTargetSet = useMemo(() => new Set(swapChoiceTargetIds ?? []), [swapChoiceTargetIds])
  const versionCursorRef = useRef({ version: -1, eventCount: 0 })
  const skipHistoryAnimationRef = useRef(true)
  const consumedMotionKeysRef = useRef(new Set<string>())
  const consumedSwapKeysRef = useRef(new Set<string>())
  const consumedShieldBreakKeysRef = useRef(new Set<string>())
  const consumedShieldGrantKeysRef = useRef(new Set<string>())
  const consumedFreezeApplyKeysRef = useRef(new Set<string>())
  const consumedFreezeExpireKeysRef = useRef(new Set<string>())
  const consumedSentHomeKeysRef = useRef(new Set<string>())
  const activeSentHomeByTokenIdRef = useRef(
    new Map<string, SentHomeAnimationPayload>(),
  )
  const activeShieldBreakByTokenIdRef = useRef(new Map<string, ShieldConsumedPayload>())
  const activeShieldGrantByTokenIdRef = useRef(new Map<string, ShieldGrantedPayload>())
  const activeFreezeApplyByTokenIdRef = useRef(new Map<string, FreezeAppliedPayload>())
  const activeFreezeExpireByTokenIdRef = useRef(new Map<string, FreezeExpiredPayload>())
  const scheduledShieldBreakKeysRef = useRef(new Set<string>())
  const scheduledShieldGrantKeysRef = useRef(new Set<string>())
  const scheduledFreezeApplyKeysRef = useRef(new Set<string>())
  const scheduledFreezeExpireKeysRef = useRef(new Set<string>())
  const scheduledSentHomeKeysRef = useRef(new Set<string>())
  const activeMoveSessionsRef = useRef(new Map<string, ActiveMoveSession>())
  const activeMoveByTokenIdRef = useRef(
    new Map<string, { key: string; plan: MotionWaypoint[] }>(),
  )

  const deltaEvents = useMemo(() => {
    if (skipHistoryAnimationRef.current) {
      return []
    }
    if (freezeTokenAnimations) {
      return []
    }
    return getDeltaEventsSinceVersion(gameState, versionCursorRef.current)
  }, [freezeTokenAnimations, gameState.version, gameState.events.length])

  useEffect(() => {
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

  const clearTokenStatusVisuals = useCallback((tokenId: string) => {
    activeShieldGrantByTokenIdRef.current.delete(tokenId)
    activeShieldBreakByTokenIdRef.current.delete(tokenId)
    activeFreezeExpireByTokenIdRef.current.delete(tokenId)
  }, [])

  const captureMoveByCapturedTokenId = useMemo(
    () => extractCaptureDetailsFromDelta(deltaEvents),
    [deltaEvents],
  )

  const sentHomeByTokenId = useMemo(
    () => extractSentHomeDetailsFromDelta(deltaEvents),
    [deltaEvents],
  )

  const swapDetails = useMemo(() => extractSwapDetailsFromDelta(deltaEvents), [deltaEvents])
  const shieldConsumedByTokenId = useMemo(
    () => extractShieldConsumedFromDelta(deltaEvents),
    [deltaEvents],
  )
  const shieldGrantedByTokenId = useMemo(
    () => extractShieldGrantedFromDelta(deltaEvents),
    [deltaEvents],
  )
  const freezeAppliedByTokenId = useMemo(
    () => extractFreezeAppliedFromDelta(deltaEvents),
    [deltaEvents],
  )
  const freezeExpiredByTokenId = useMemo(
    () => extractFreezeExpiredFromDelta(deltaEvents),
    [deltaEvents],
  )
  const swapEventTimestamp = useMemo(() => {
    for (let index = deltaEvents.length - 1; index >= 0; index -= 1) {
      if (deltaEvents[index]?.type === 'token_swapped') {
        return deltaEvents[index]!.timestamp
      }
    }
    return 0
  }, [deltaEvents])

  useEffect(() => {
    if (!swapDetails || swapEventTimestamp <= 0) {
      return
    }
    const swapKey = `${swapDetails.activatorTokenId}:${swapDetails.targetTokenId}:${swapEventTimestamp}`
    if (consumedSwapKeysRef.current.has(swapKey)) {
      return
    }
    latchedSwapRef.current = {
      key: swapKey,
      details: swapDetails,
      timestamp: swapEventTimestamp,
    }
    setSwapDeferRevision((revision) => revision + 1)
  }, [swapDetails, swapEventTimestamp])

  const latchedSwap = latchedSwapRef.current

  const handleMoveAnimationDone = useCallback((tokenId: string, motionPlanKey: string) => {
    const session = activeMoveSessionsRef.current.get(tokenId)
    if (session && isSegmentPausePending(session)) {
      return
    }
    const latchedMove = latchedMoveByTokenIdRef.current.get(tokenId)
    if (session) {
      consumedMotionKeysRef.current.add(session.baseKey)
      activeMoveSessionsRef.current.delete(tokenId)
    } else if (latchedMove) {
      consumedMotionKeysRef.current.add(
        buildRawMotionPlanKey(tokenId, latchedMove),
      )
    } else {
      consumedMotionKeysRef.current.add(motionPlanKey)
    }
    latchedMoveByTokenIdRef.current.delete(tokenId)
    activeMoveByTokenIdRef.current.delete(tokenId)
    markerVisibility?.notifyMoveAnimationDone(tokenId)
    setSwapDeferRevision((revision) => revision + 1)
    setMoveOrchestrationRevision((revision) => revision + 1)
  }, [gameState.version, markerVisibility])

  const advanceMoveSessionsAfterShieldBreak = useCallback((shieldKey: string) => {
    activeMoveSessionsRef.current.forEach((session, tokenId) => {
      if (session.shieldBreakKey !== shieldKey) {
        return
      }
      session.shieldBreakComplete = true
      session.awaitingShieldBreak = false
      if (session.pauseBeforeMove) {
        activeMoveSessionsRef.current.set(tokenId, session)
        return
      }
      if (session.segmentIndex < session.paths.length - 1) {
        session.segmentIndex += 1
        activeMoveSessionsRef.current.set(tokenId, session)
        return
      }
      consumedMotionKeysRef.current.add(session.baseKey)
      activeMoveSessionsRef.current.delete(tokenId)
    })
    setMoveOrchestrationRevision((revision) => revision + 1)
  }, [])

  const advanceMoveSessionsAfterShieldGrant = useCallback((grantKey: string) => {
    activeMoveSessionsRef.current.forEach((session, tokenId) => {
      if (session.shieldGrantKey !== grantKey) {
        return
      }
      session.shieldGrantComplete = true
      session.awaitingShieldGrant = false
      if (session.segmentIndex < session.paths.length - 1) {
        session.segmentIndex += 1
        activeMoveSessionsRef.current.set(tokenId, session)
        return
      }
      consumedMotionKeysRef.current.add(session.baseKey)
      activeMoveSessionsRef.current.delete(tokenId)
      activeMoveByTokenIdRef.current.delete(tokenId)
      latchedMoveByTokenIdRef.current.delete(tokenId)
      markerVisibility?.notifyMoveAnimationDone(tokenId)
    })
    setMoveOrchestrationRevision((revision) => revision + 1)
  }, [markerVisibility])

  const advanceMoveSessionsAfterFreezeApply = useCallback((freezeKey: string) => {
    activeMoveSessionsRef.current.forEach((session, tokenId) => {
      if (session.freezeApplyKey !== freezeKey) {
        return
      }
      session.freezeApplyComplete = true
      session.awaitingFreezeApply = false
      if (session.segmentIndex < session.paths.length - 1) {
        session.segmentIndex += 1
        activeMoveSessionsRef.current.set(tokenId, session)
        return
      }
      consumedMotionKeysRef.current.add(session.baseKey)
      activeMoveSessionsRef.current.delete(tokenId)
      activeMoveByTokenIdRef.current.delete(tokenId)
      latchedMoveByTokenIdRef.current.delete(tokenId)
      markerVisibility?.notifyMoveAnimationDone(tokenId)
    })
    setMoveOrchestrationRevision((revision) => revision + 1)
  }, [markerVisibility])

  const scheduleShieldBreak = useCallback(
    (payload: ShieldConsumedPayload) => {
      if (consumedShieldBreakKeysRef.current.has(payload.key)) {
        return
      }
      if (scheduledShieldBreakKeysRef.current.has(payload.key)) {
        return
      }
      scheduledShieldBreakKeysRef.current.add(payload.key)
      window.setTimeout(() => {
        consumedShieldBreakKeysRef.current.add(payload.key)
        activeShieldBreakByTokenIdRef.current.delete(payload.tokenId)
        scheduledShieldBreakKeysRef.current.delete(payload.key)
        advanceMoveSessionsAfterShieldBreak(payload.key)
        setShieldBreakRevision((revision) => revision + 1)
      }, 900)
    },
    [advanceMoveSessionsAfterShieldBreak],
  )

  const scheduleShieldGrant = useCallback(
    (payload: ShieldGrantedPayload) => {
      if (consumedShieldGrantKeysRef.current.has(payload.key)) {
        return
      }
      if (scheduledShieldGrantKeysRef.current.has(payload.key)) {
        return
      }
      scheduledShieldGrantKeysRef.current.add(payload.key)
      window.setTimeout(() => {
        consumedShieldGrantKeysRef.current.add(payload.key)
        scheduledShieldGrantKeysRef.current.delete(payload.key)
        activeShieldGrantByTokenIdRef.current.delete(payload.tokenId)
        advanceMoveSessionsAfterShieldGrant(payload.key)
        setShieldGrantRevision((revision) => revision + 1)
      }, 850)
    },
    [advanceMoveSessionsAfterShieldGrant],
  )

  const scheduleFreezeApply = useCallback(
    (payload: FreezeAppliedPayload) => {
      if (consumedFreezeApplyKeysRef.current.has(payload.key)) {
        return
      }
      if (scheduledFreezeApplyKeysRef.current.has(payload.key)) {
        return
      }
      scheduledFreezeApplyKeysRef.current.add(payload.key)
      window.setTimeout(() => {
        consumedFreezeApplyKeysRef.current.add(payload.key)
        activeFreezeApplyByTokenIdRef.current.delete(payload.tokenId)
        scheduledFreezeApplyKeysRef.current.delete(payload.key)
        advanceMoveSessionsAfterFreezeApply(payload.key)
        setFreezeApplyRevision((revision) => revision + 1)
      }, 850)
    },
    [advanceMoveSessionsAfterFreezeApply],
  )

  const scheduleFreezeExpire = useCallback((payload: FreezeExpiredPayload) => {
    if (consumedFreezeExpireKeysRef.current.has(payload.key)) {
      return
    }
    if (scheduledFreezeExpireKeysRef.current.has(payload.key)) {
      return
    }
    scheduledFreezeExpireKeysRef.current.add(payload.key)
    window.setTimeout(() => {
      consumedFreezeExpireKeysRef.current.add(payload.key)
      activeFreezeExpireByTokenIdRef.current.delete(payload.tokenId)
      scheduledFreezeExpireKeysRef.current.delete(payload.key)
      setFreezeExpireRevision((revision) => revision + 1)
    }, 880)
  }, [])

  const handleMoveStepLanded = useCallback(
    (tokenId: string, playerSlot: number, step: MockPathStep, worldX: number, worldZ: number) => {
      markerVisibility?.notifyTokenSteppedOnCell(tokenId, playerSlot, step, worldX, worldZ)

      const movePayload = latchedMoveByTokenIdRef.current.get(tokenId)
      const session = activeMoveSessionsRef.current.get(tokenId)

      const freezePayload = activeFreezeApplyByTokenIdRef.current.get(tokenId)
      if (freezePayload && !consumedFreezeApplyKeysRef.current.has(freezePayload.key)) {
        if (!scheduledFreezeApplyKeysRef.current.has(freezePayload.key)) {
          if (
            !freezePayload.at ||
            statusEffectStepMatches(freezePayload.at, step, movePayload)
          ) {
            if (session?.freezeApplyKey === freezePayload.key) {
              session.awaitingFreezeApply = true
            }
            scheduleFreezeApply(freezePayload)
            setFreezeApplyRevision((revision) => revision + 1)
            setMoveOrchestrationRevision((revision) => revision + 1)
          }
        }
      }

      const grantPayload = activeShieldGrantByTokenIdRef.current.get(tokenId)
      if (grantPayload && !consumedShieldGrantKeysRef.current.has(grantPayload.key)) {
        if (!scheduledShieldGrantKeysRef.current.has(grantPayload.key)) {
          if (
            !grantPayload.at ||
            statusEffectStepMatches(grantPayload.at, step, movePayload)
          ) {
            if (session?.shieldGrantKey === grantPayload.key) {
              session.awaitingShieldGrant = true
            }
            scheduleShieldGrant(grantPayload)
            setShieldGrantRevision((revision) => revision + 1)
            setMoveOrchestrationRevision((revision) => revision + 1)
          }
        }
      }
    },
    [markerVisibility, scheduleFreezeApply, scheduleShieldGrant],
  )

  const handleMoveSegmentComplete = useCallback(
    (tokenId: string) => {
      const session = activeMoveSessionsRef.current.get(tokenId)
      if (!session) {
        return
      }

      if (
        session.shieldGrantKey &&
        session.pauseAfterSegment[session.segmentIndex] === 'shield_grant' &&
        !session.shieldGrantComplete
      ) {
        session.awaitingShieldGrant = true
        const grantPayload = activeShieldGrantByTokenIdRef.current.get(tokenId)
        if (grantPayload) {
          scheduleShieldGrant(grantPayload)
        }
        setMoveOrchestrationRevision((revision) => revision + 1)
        return
      }

      if (
        session.shieldBreakKey &&
        session.pauseAfterSegment[session.segmentIndex] === 'shield_break' &&
        !session.shieldBreakComplete
      ) {
        session.awaitingShieldBreak = true
        const payload = activeShieldBreakByTokenIdRef.current.get(tokenId)
        if (payload) {
          scheduleShieldBreak(payload)
        }
        setMoveOrchestrationRevision((revision) => revision + 1)
        return
      }

      if (
        session.freezeApplyKey &&
        session.pauseAfterSegment[session.segmentIndex] === 'freeze_apply' &&
        !session.freezeApplyComplete
      ) {
        session.awaitingFreezeApply = true
        const payload = activeFreezeApplyByTokenIdRef.current.get(tokenId)
        if (payload) {
          scheduleFreezeApply(payload)
        }
        setMoveOrchestrationRevision((revision) => revision + 1)
        return
      }

      if (session.segmentIndex < session.paths.length - 1) {
        session.segmentIndex += 1
        setMoveOrchestrationRevision((revision) => revision + 1)
        return
      }

      consumedMotionKeysRef.current.add(session.baseKey)
      activeMoveSessionsRef.current.delete(tokenId)
      activeMoveByTokenIdRef.current.delete(tokenId)
      latchedMoveByTokenIdRef.current.delete(tokenId)
      markerVisibility?.notifyMoveAnimationDone(tokenId)
      setSwapDeferRevision((revision) => revision + 1)
      setMoveOrchestrationRevision((revision) => revision + 1)
    },
    [markerVisibility, scheduleFreezeApply, scheduleShieldBreak, scheduleShieldGrant],
  )

  const tokensWithTargets = useMemo(() => {
    moveEventByTokenId.forEach((payload, tokenId) => {
      const rawKey = buildRawMotionPlanKey(tokenId, payload)
      if (consumedMotionKeysRef.current.has(rawKey)) {
        return
      }
      latchedMoveByTokenIdRef.current.set(tokenId, payload)
    })

    const latchedSwapSnapshot = latchedSwapRef.current
    const activatorMovePayload = latchedSwapSnapshot
      ? latchedMoveByTokenIdRef.current.get(latchedSwapSnapshot.details.activatorTokenId) ??
        moveEventByTokenId.get(latchedSwapSnapshot.details.activatorTokenId)
      : undefined
    const activatorApproachPending = latchedSwapSnapshot
      ? isTokenMoveAnimationPending(
          latchedSwapSnapshot.details.activatorTokenId,
          activatorMovePayload,
          activeMoveSessionsRef.current,
          consumedMotionKeysRef.current,
        )
      : false

    return gameState.tokens.map((token) => {
      const playerIndex = playerIndexById[token.playerId] ?? 0
      const movePayload =
        latchedMoveByTokenIdRef.current.get(token.id) ?? moveEventByTokenId.get(token.id)
      const rawMotionPlanKey = movePayload
        ? buildRawMotionPlanKey(token.id, movePayload)
        : null

      if (
        movePayload &&
        movePayload.details.path.length === 0 &&
        rawMotionPlanKey &&
        !consumedMotionKeysRef.current.has(rawMotionPlanKey)
      ) {
        consumedMotionKeysRef.current.add(rawMotionPlanKey)
        latchedMoveByTokenIdRef.current.delete(token.id)
        activeMoveSessionsRef.current.delete(token.id)
        activeMoveByTokenIdRef.current.delete(token.id)
      }

      const statePosition = tokenStateToWorldPosition(token, playerIndex)
      const sentHomePayload = sentHomeByTokenId.get(token.id)
      const capturePayload = captureMoveByCapturedTokenId.get(token.id)
      if (sentHomePayload && !consumedSentHomeKeysRef.current.has(sentHomePayload.key)) {
        activeSentHomeByTokenIdRef.current.set(token.id, sentHomePayload)
        clearTokenStatusVisuals(token.id)
        if (rawMotionPlanKey) {
          consumedMotionKeysRef.current.add(rawMotionPlanKey)
          activeMoveSessionsRef.current.delete(token.id)
          activeMoveByTokenIdRef.current.delete(token.id)
        }
      } else if (capturePayload) {
        clearTokenStatusVisuals(token.id)
      }

      const shieldFromDelta = shieldConsumedByTokenId.get(token.id)
      const shieldGrantFromDelta = shieldGrantedByTokenId.get(token.id)
      if (shieldFromDelta && !consumedShieldBreakKeysRef.current.has(shieldFromDelta.key)) {
        activeShieldBreakByTokenIdRef.current.set(token.id, shieldFromDelta)
      }
      if (shieldGrantFromDelta && !consumedShieldGrantKeysRef.current.has(shieldGrantFromDelta.key)) {
        activeShieldGrantByTokenIdRef.current.set(token.id, shieldGrantFromDelta)
      }
      const freezeFromDelta = freezeAppliedByTokenId.get(token.id)
      if (freezeFromDelta && !consumedFreezeApplyKeysRef.current.has(freezeFromDelta.key)) {
        activeFreezeApplyByTokenIdRef.current.set(token.id, freezeFromDelta)
      }
      const freezeExpireFromDelta = freezeExpiredByTokenId.get(token.id)
      if (freezeExpireFromDelta && !consumedFreezeExpireKeysRef.current.has(freezeExpireFromDelta.key)) {
        activeFreezeExpireByTokenIdRef.current.set(token.id, freezeExpireFromDelta)
      }

      const activeSentHome = activeSentHomeByTokenIdRef.current.get(token.id)
      const sentHomeAnimationActive = Boolean(
        activeSentHome && !consumedSentHomeKeysRef.current.has(activeSentHome.key),
      )

      const activeShieldBreak = activeShieldBreakByTokenIdRef.current.get(token.id)
      const shieldBreakAnimationActive = Boolean(
        activeShieldBreak && !consumedShieldBreakKeysRef.current.has(activeShieldBreak.key),
      )

      if (
        rawMotionPlanKey &&
        movePayload &&
        !consumedMotionKeysRef.current.has(rawMotionPlanKey) &&
        !sentHomeAnimationActive
      ) {
        const existingSession = activeMoveSessionsRef.current.get(token.id)
        const freezePayloadForSession =
          activeFreezeApplyByTokenIdRef.current.get(token.id) ?? freezeFromDelta
        const needsMoveSession =
          !existingSession ||
          existingSession.baseKey !== rawMotionPlanKey ||
          (freezePayloadForSession &&
            existingSession.freezeApplyKey !== freezePayloadForSession.key)
        if (needsMoveSession) {
          const session = buildMoveSession(
            movePayload,
            rawMotionPlanKey,
            activeShieldBreak ?? shieldFromDelta,
            activeShieldGrantByTokenIdRef.current.get(token.id) ?? shieldGrantFromDelta,
            freezePayloadForSession,
          )
          if (session) {
            activeMoveSessionsRef.current.set(token.id, session)
          }
        }
      }

      const moveSession = activeMoveSessionsRef.current.get(token.id)
      const moveBlockedBeforeShield =
        Boolean(
          moveSession &&
            moveSession.pauseBeforeMove &&
            !moveSession.shieldBreakComplete &&
            moveSession.shieldBreakKey,
        )
      const moveAwaitingShieldBreak = Boolean(moveSession?.awaitingShieldBreak)
      const moveAwaitingShieldGrant = Boolean(moveSession?.awaitingShieldGrant)
      const moveAwaitingFreezeApply = Boolean(moveSession?.awaitingFreezeApply)
      const moveAnimationHold =
        moveBlockedBeforeShield ||
        moveAwaitingShieldBreak ||
        moveAwaitingShieldGrant ||
        moveAwaitingFreezeApply

      let motionPlanKey: string | null = null
      let motionPlan: MotionWaypoint[] | null = null
      if (
        moveSession &&
        !consumedMotionKeysRef.current.has(moveSession.baseKey) &&
        !sentHomeAnimationActive &&
        !moveAnimationHold
      ) {
        const segmentPath = moveSession.paths[moveSession.segmentIndex]
        if (segmentPath && segmentPath.length > 0) {
          const obstaclePositions = gameState.tokens
            .filter((other) => other.id !== token.id)
            .map((other) => {
              if (
                latchedSwapSnapshot &&
                !consumedSwapKeysRef.current.has(latchedSwapSnapshot.key) &&
                activatorApproachPending
              ) {
                const { details } = latchedSwapSnapshot
                const otherIndex = playerIndexById[other.playerId] ?? 0
                if (other.id === details.targetTokenId) {
                  return worldPositionFromStep(otherIndex, other.id, details.targetFrom)
                }
                if (other.id === details.activatorTokenId) {
                  return worldPositionFromStep(otherIndex, other.id, details.activatorFrom)
                }
              }
              return tokenStateToWorldPosition(other, playerIndexById[other.playerId] ?? 0)
            })
          let segmentStart: THREE.Vector3 | undefined
          if (movePayload) {
            if (moveSession.segmentIndex > 0) {
              const previousPath = moveSession.paths[moveSession.segmentIndex - 1]
              const lastStep = previousPath?.[previousPath.length - 1]
              if (lastStep) {
                segmentStart = worldPositionForTokenStep(token.id, playerIndex, lastStep)
              }
            } else if (movePayload.details.from) {
              segmentStart = worldPositionForTokenStep(
                token.id,
                playerIndex,
                movePayload.details.from as MockPathStep,
              )
            }
          }
          motionPlan = motionPlanFromPathSteps(segmentPath, token.id, playerIndex, {
            segmentStart,
            obstaclePositions,
          })
          motionPlanKey = `${moveSession.baseKey}:seg:${moveSession.segmentIndex}:${moveSession.shieldBreakComplete ? 1 : 0}:${moveSession.freezeApplyComplete ? 1 : 0}`
        }
      }

      const isFinalMoveSegment = moveSession
        ? moveSession.segmentIndex >= moveSession.paths.length - 1 && !isSegmentPausePending(moveSession)
        : true
      const moveFromState = movePayload?.details.from.state
      const pendingMoveAnimation = Boolean(
        rawMotionPlanKey &&
          movePayload &&
          movePayload.details.path.length > 0 &&
          !consumedMotionKeysRef.current.has(rawMotionPlanKey) &&
          !sentHomeAnimationActive &&
          !moveBlockedBeforeShield,
      )
      const motionOriginWorld =
        pendingMoveAnimation &&
        movePayload?.details.from &&
        (moveSession?.segmentIndex ?? 0) === 0
          ? worldPositionForTokenStep(
              token.id,
              playerIndex,
              movePayload.details.from as MockPathStep,
            )
          : null
      let captureMotion: CaptureMotion | null = null
      if (token.state === 'in_base') {
        captureMotion =
          captureMotionFromEvent(captureMoveByCapturedTokenId.get(token.id), playerIndexById, token) ??
          (sentHomeAnimationActive
            ? sentHomeMotionFromEvent(activeSentHome, playerIndex, token)
            : null)
      }
      let swapMotion: SwapMotion | null = null
      if (latchedSwapSnapshot && !consumedSwapKeysRef.current.has(latchedSwapSnapshot.key)) {
        if (!activatorApproachPending) {
          swapMotion = swapMotionForToken(
            latchedSwapSnapshot.details,
            token,
            playerIndex,
            latchedSwapSnapshot.timestamp,
          )
        }
      }
      const visualPosition = resolveSwapVisualPosition(
        token,
        playerIndex,
        statePosition,
        latchedSwapSnapshot,
        consumedSwapKeysRef.current,
        swapMotion,
      )
      const isFrozen = token.state !== 'in_base' && (token.freezeTurnsRemaining ?? 0) > 0
      const isSelectable = selectableTokenSet.has(token.id) && !isFrozen
      const isSwapChoiceTarget = swapChoiceTargetSet.has(token.id)
      const isPickable = isSelectable || (isSwapChoiceTarget && swapSelectionEnabled)
      const moveStillAnimating = isTokenMoveAnimationPending(
        token.id,
        movePayload,
        activeMoveSessionsRef.current,
        consumedMotionKeysRef.current,
      )
      const swapPreviewSpin =
        !latchedSwapSnapshot && swapPreviewTokenSet.has(token.id) && !moveStillAnimating
      let shieldBreakMotion: ShieldBreakMotion | null = null
      const shieldBreakPayload = activeShieldBreak ?? shieldFromDelta
      const shouldShowShieldBreak =
        shieldBreakAnimationActive &&
        shieldBreakPayload &&
        (moveBlockedBeforeShield || moveAwaitingShieldBreak)
      if (shouldShowShieldBreak) {
        const shieldStackIndex = isFrozen ? 1 : 0
        shieldBreakMotion = {
          key: shieldBreakPayload.key,
          billboardY: statusBillboardY(isSelectable, shieldStackIndex),
        }
      }
      let freezeApplyMotion: FreezeApplyMotion | null = null
      const freezeApplyPayload = activeFreezeApplyByTokenIdRef.current.get(token.id) ?? freezeFromDelta
      const freezeApplyAnimationActive = Boolean(
        freezeApplyPayload && !consumedFreezeApplyKeysRef.current.has(freezeApplyPayload.key),
      )
      const shouldShowFreezeApply =
        freezeApplyAnimationActive &&
        freezeApplyPayload &&
        (scheduledFreezeApplyKeysRef.current.has(freezeApplyPayload.key) ||
          moveAwaitingFreezeApply)
      if (shouldShowFreezeApply) {
        freezeApplyMotion = {
          key: freezeApplyPayload.key,
          billboardY: statusBillboardY(isSelectable, 0),
        }
      }
      let freezeExpireMotion: FreezeExpireMotion | null = null
      const freezeExpirePayload =
        activeFreezeExpireByTokenIdRef.current.get(token.id) ?? freezeExpireFromDelta
      const freezeExpireAnimationActive = Boolean(
        freezeExpirePayload && !consumedFreezeExpireKeysRef.current.has(freezeExpirePayload.key),
      )
      const shouldShowFreezeExpire =
        freezeExpireAnimationActive &&
        freezeExpirePayload &&
        scheduledFreezeExpireKeysRef.current.has(freezeExpirePayload.key)
      if (shouldShowFreezeExpire) {
        freezeExpireMotion = {
          key: freezeExpirePayload.key,
          billboardY: statusBillboardY(isSelectable, 0),
        }
      }
      const suppressFrozenStatusIcon = freezeApplyAnimationActive
      const showFrozenStatusIcon =
        (isFrozen || freezeExpireAnimationActive) &&
        !freezeApplyMotion &&
        !freezeExpireMotion &&
        !suppressFrozenStatusIcon
      let shieldGrantMotion: ShieldGrantMotion | null = null
      const shieldGrantPayload =
        activeShieldGrantByTokenIdRef.current.get(token.id) ?? shieldGrantFromDelta
      const shieldGrantAnimationActive = Boolean(
        shieldGrantPayload && !consumedShieldGrantKeysRef.current.has(shieldGrantPayload.key),
      )
      const shouldShowShieldGrant =
        shieldGrantAnimationActive &&
        shieldGrantPayload &&
        (scheduledShieldGrantKeysRef.current.has(shieldGrantPayload.key) ||
          moveAwaitingShieldGrant)
      if (shouldShowShieldGrant) {
        const shieldStackIndex = isFrozen ? 1 : 0
        shieldGrantMotion = {
          key: shieldGrantPayload.key,
          billboardY: statusBillboardY(isSelectable, shieldStackIndex),
        }
      }
      const isHovered = (isSelectable || isSwapChoiceTarget) && hoveredTokenId === token.id
      const arrowColor = isHovered
        ? tokenSelectionMode === 'swap'
          ? '#f0abfc'
          : '#22d3ee'
        : '#f8fafc'

      return {
        token,
        playerIndex,
        targetX: visualPosition.x,
        targetY: visualPosition.y,
        targetZ: visualPosition.z,
        motionPlan: swapMotion ? null : motionPlan,
        motionPlanKey: swapMotion ? null : motionPlanKey,
        moveFromState,
        motionOriginWorld,
        captureMotion: swapMotion ? null : captureMotion,
        swapMotion,
        shieldBreakMotion,
        shieldGrantMotion,
        freezeApplyMotion,
        freezeExpireMotion,
        showFrozenStatusIcon,
        suppressFrozenStatusIcon: freezeApplyAnimationActive,
        suppressShieldStatusIcon: shieldGrantAnimationActive,
        moveAnimationHold,
        isFinalMoveSegment,
        pendingMoveAnimation,
        isSelectable,
        isSwapChoiceTarget,
        isPickable,
        swapPreviewSpin,
        arrowColor,
      }
    })
  }, [
    clearTokenStatusVisuals,
    captureMoveByCapturedTokenId,
    sentHomeByTokenId,
    gameState.tokens,
    gameState.version,
    hoveredTokenId,
    moveEventByTokenId,
    playerIndexById,
    selectableTokenSet,
    swapActivatorTokenId,
    swapPreviewTokenIds,
    swapChoiceTargetIds,
    swapSelectionEnabled,
    swapDetails,
    swapEventTimestamp,
    shieldConsumedByTokenId,
    shieldGrantedByTokenId,
    freezeAppliedByTokenId,
    freezeExpiredByTokenId,
    shieldBreakRevision,
    shieldGrantRevision,
    freezeApplyRevision,
    freezeExpireRevision,
    sentHomeRevision,
    moveOrchestrationRevision,
    swapDeferRevision,
    latchedSwap,
    tokenSelectionMode,
  ])

  useEffect(() => {
    if (!latchedSwap) {
      return
    }
    const activatorPayload =
      latchedMoveByTokenIdRef.current.get(latchedSwap.details.activatorTokenId) ??
      moveEventByTokenId.get(latchedSwap.details.activatorTokenId)
    const deferSwap = isTokenMoveAnimationPending(
      latchedSwap.details.activatorTokenId,
      activatorPayload,
      activeMoveSessionsRef.current,
      consumedMotionKeysRef.current,
    )
    if (deferSwap) {
      return
    }

    const swapKey = latchedSwap.key
    setActiveSwapArcKey(swapKey)
    const timer = window.setTimeout(() => {
      consumedSwapKeysRef.current.add(swapKey)
      if (latchedSwapRef.current?.key === swapKey) {
        latchedSwapRef.current = null
      }
      setActiveSwapArcKey((current) => (current === swapKey ? null : current))
      setSwapDeferRevision((revision) => revision + 1)
    }, 950)
    return () => window.clearTimeout(timer)
  }, [gameState.version, latchedSwap, moveEventByTokenId, moveOrchestrationRevision, swapDeferRevision])

  useEffect(() => {
    activeMoveSessionsRef.current.forEach((session, tokenId) => {
      if (!session.pauseBeforeMove || session.shieldBreakComplete || !session.shieldBreakKey) {
        return
      }
      const payload = activeShieldBreakByTokenIdRef.current.get(tokenId)
      if (payload) {
        scheduleShieldBreak(payload)
      }
    })
  }, [moveOrchestrationRevision, scheduleShieldBreak])

  useEffect(() => {
    sentHomeByTokenId.forEach((payload) => {
      if (consumedSentHomeKeysRef.current.has(payload.key)) {
        return
      }
      if (scheduledSentHomeKeysRef.current.has(payload.key)) {
        return
      }
      scheduledSentHomeKeysRef.current.add(payload.key)
      window.setTimeout(() => {
        consumedSentHomeKeysRef.current.add(payload.key)
        activeSentHomeByTokenIdRef.current.delete(payload.details.tokenId)
        scheduledSentHomeKeysRef.current.delete(payload.key)
        setSentHomeRevision((revision) => revision + 1)
      }, 900)
    })
  }, [sentHomeByTokenId])

  useEffect(() => {
    shieldGrantedByTokenId.forEach((payload, tokenId) => {
      if (consumedShieldGrantKeysRef.current.has(payload.key)) {
        return
      }
      if (scheduledShieldGrantKeysRef.current.has(payload.key)) {
        return
      }

      const movePayload =
        latchedMoveByTokenIdRef.current.get(tokenId) ?? moveEventByTokenId.get(tokenId)
      if (
        isTokenMoveAnimationPending(
          tokenId,
          movePayload,
          activeMoveSessionsRef.current,
          consumedMotionKeysRef.current,
        )
      ) {
        return
      }

      const token = gameState.tokens.find((entry) => entry.id === tokenId)
      if (!token || !token.hasShield || token.state === 'in_base') {
        return
      }

      const session = activeMoveSessionsRef.current.get(tokenId)
      if (session?.shieldGrantKey === payload.key) {
        session.awaitingShieldGrant = true
      }
      scheduleShieldGrant(payload)
      setShieldGrantRevision((revision) => revision + 1)
    })
  }, [
    shieldGrantedByTokenId,
    gameState.tokens,
    moveEventByTokenId,
    moveOrchestrationRevision,
    scheduleShieldGrant,
  ])

  useEffect(() => {
    freezeExpiredByTokenId.forEach((payload, tokenId) => {
      if (consumedFreezeExpireKeysRef.current.has(payload.key)) {
        return
      }
      if (scheduledFreezeExpireKeysRef.current.has(payload.key)) {
        return
      }

      const token = gameState.tokens.find((entry) => entry.id === tokenId)
      if (!token || token.state === 'in_base') {
        return
      }

      scheduleFreezeExpire(payload)
      setFreezeExpireRevision((revision) => revision + 1)
    })
  }, [freezeExpiredByTokenId, gameState.tokens, scheduleFreezeExpire])

  useEffect(() => {
    freezeAppliedByTokenId.forEach((payload, tokenId) => {
      if (consumedFreezeApplyKeysRef.current.has(payload.key)) {
        return
      }
      if (scheduledFreezeApplyKeysRef.current.has(payload.key)) {
        return
      }

      const movePayload =
        latchedMoveByTokenIdRef.current.get(tokenId) ?? moveEventByTokenId.get(tokenId)
      if (
        isTokenMoveAnimationPending(
          tokenId,
          movePayload,
          activeMoveSessionsRef.current,
          consumedMotionKeysRef.current,
        )
      ) {
        return
      }

      const token = gameState.tokens.find((entry) => entry.id === tokenId)
      if (!token || (token.freezeTurnsRemaining ?? 0) <= 0) {
        return
      }

      const session = activeMoveSessionsRef.current.get(tokenId)
      if (session?.freezeApplyKey === payload.key) {
        session.awaitingFreezeApply = true
      }
      scheduleFreezeApply(payload)
      setFreezeApplyRevision((revision) => revision + 1)
    })
  }, [
    freezeAppliedByTokenId,
    gameState.tokens,
    moveEventByTokenId,
    moveOrchestrationRevision,
    scheduleFreezeApply,
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
        return (
          <HousePlaceholder
            key={`house-${p.id}`}
            box={home}
            color={PLAYER_COLOR_HEX[p.color] ?? '#ddd'}
            cartoonMaterials={cartoonMaterials}
            basicMaterials={basicMaterials}
            castShadow={shadowsEnabled}
          />
        )
      })}

      {tokenSelectionMode === 'swap' && swapActivatorTokenId && swapChoiceTargetIds && swapChoiceTargetIds.length > 0 ? (
        <SwapChoiceGuides
          gameState={gameState}
          playerIndexById={playerIndexById}
          activatorTokenId={swapActivatorTokenId}
          selectableTokenIds={swapChoiceTargetIds}
        />
      ) : null}

      {latchedSwap && activeSwapArcKey === latchedSwap.key ? (
        <SwapExchangeArc
          gameState={gameState}
          swapDetails={latchedSwap.details}
          playerIndexById={playerIndexById}
        />
      ) : null}

      {/* Pawns */}
      {tokensWithTargets.map(({ token, playerIndex, targetX, targetY, targetZ, motionPlan, motionPlanKey, moveFromState, motionOriginWorld, captureMotion, swapMotion, shieldBreakMotion, shieldGrantMotion, freezeApplyMotion, freezeExpireMotion, showFrozenStatusIcon, suppressFrozenStatusIcon, suppressShieldStatusIcon, moveAnimationHold, isFinalMoveSegment, pendingMoveAnimation, isSelectable, isSwapChoiceTarget, isPickable, swapPreviewSpin, arrowColor }) => (
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
            swapMotion={swapMotion}
            swapPreviewSpin={swapPreviewSpin}
            shieldBreakMotion={shieldBreakMotion}
            shieldGrantMotion={shieldGrantMotion}
            freezeApplyMotion={freezeApplyMotion}
            freezeExpireMotion={freezeExpireMotion}
            showFrozenStatusIcon={showFrozenStatusIcon}
            suppressFrozenStatusIcon={suppressFrozenStatusIcon}
            suppressShieldStatusIcon={suppressShieldStatusIcon}
            moveAnimationHold={moveAnimationHold}
            isFinalMoveSegment={isFinalMoveSegment}
            pendingMoveAnimation={pendingMoveAnimation}
            isSelectable={isSelectable}
            isSwapChoiceTarget={isSwapChoiceTarget}
            selectionMode={tokenSelectionMode}
            arrowColor={arrowColor}
            isHovered={(isSelectable || isSwapChoiceTarget) && hoveredTokenId === token.id}
            spawnImpact={freezeTokenAnimations ? null : spawnImpactRef.current}
            moveFromState={moveFromState}
            motionOriginWorld={motionOriginWorld}
            onMoveAnimationDone={(key) => handleMoveAnimationDone(token.id, key)}
            onMoveSegmentComplete={() => handleMoveSegmentComplete(token.id)}
            onMoveStepLanded={(step, worldX, worldZ) =>
              handleMoveStepLanded(token.id, playerIndex, step, worldX, worldZ)
            }
            onPointerDown={(event) => {
              if (!isPickable || !onSelectToken) {
                return
              }
              event.stopPropagation()
              onSelectToken(token.id)
            }}
            onPointerOver={(event) => {
              if (!isPickable) {
                return
              }
              event.stopPropagation()
              setHoveredTokenId(token.id)
            }}
            onPointerOut={(event) => {
              if (!isPickable) {
                return
              }
              event.stopPropagation()
              setHoveredTokenId((current) => (current === token.id ? null : current))
            }}
            animationDurationMs={animationDurationMs}
            cartoonMaterials={cartoonMaterials}
            basicMaterials={basicMaterials}
            reduceMeshDetail={reduceMeshDetail}
            castShadow={shadowsEnabled}
          />
        </group>
      ))}
    </group>
  )
}
