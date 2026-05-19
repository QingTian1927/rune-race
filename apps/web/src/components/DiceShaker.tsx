import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { GameState } from '@rune-race/shared'
import boardLayout from '../../data/board-layout.json'

type DiceAnimationPhase = 'idle' | 'appearing' | 'shaking' | 'lifting' | 'revealing' | 'finished'

interface DiceShakerProps {
  gameState: GameState
  rollTrigger: number
}

const BUCKET_MODEL_PATH = '/assets/models/bucket.glb'
const DICE_MODEL_PATH = '/assets/models/dice.glb'

const PHASE_DURATIONS: Record<Exclude<DiceAnimationPhase, 'idle' | 'finished'>, number> = {
  appearing: 0.22,
  shaking: 1.1,
  lifting: 0.42,
  revealing: 0.22,
}

function cloneModel(scene: THREE.Group): THREE.Group {
  const clone = scene.clone(true)

  clone.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) {
      return
    }

    const mesh = node as THREE.Mesh
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone())
    } else if (mesh.material) {
      mesh.material = mesh.material.clone()
    }
  })

  return clone
}

function normalizeModel(scene: THREE.Group, targetSize: { x: number; y: number; z: number }) {
  const clone = cloneModel(scene)
  const box = new THREE.Box3().setFromObject(clone)

  if (box.isEmpty()) {
    return clone
  }

  const size = new THREE.Vector3()
  box.getSize(size)

  const scale = Math.min(
    targetSize.x / Math.max(size.x, 1e-6),
    targetSize.y / Math.max(size.y, 1e-6),
    targetSize.z / Math.max(size.z, 1e-6),
  )

  clone.scale.setScalar(scale)

  const scaledBox = new THREE.Box3().setFromObject(clone)
  const center = new THREE.Vector3()
  scaledBox.getCenter(center)

  clone.position.set(-center.x, -scaledBox.min.y, -center.z)
  return clone
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

function latestDiceRollSignal(gameState: GameState): string {
  const rollEvent = [...gameState.events].reverse().find((event) => event.type === 'dice_roll')
  if (rollEvent) {
    return `${rollEvent.timestamp}:${gameState.turn.diceResult ?? 'none'}`
  }

  return `${gameState.version}:${gameState.turn.diceResult ?? 'none'}`
}

function resultToRotationY(result: number): number {
  switch (((result - 1) % 6) + 1) {
    case 1:
      return 0.42
    case 2:
      return 1.18
    case 3:
      return 2.03
    case 4:
      return 2.78
    case 5:
      return 3.52
    default:
      return 4.18
  }
}

export default function DiceShaker({ gameState, rollTrigger }: DiceShakerProps) {
  const layout = boardLayout as any
  const diceBox = layout?.dice ?? null
  const rollResult = gameState.turn.diceResult ?? 1
  const rollSignal = useMemo(() => latestDiceRollSignal(gameState), [gameState])

  const bucketRef = useRef<THREE.Group | null>(null)
  const diceRef = useRef<THREE.Group | null>(null)
  const phaseRef = useRef<DiceAnimationPhase>('idle')
  const phaseStartRef = useRef<number>(-1)
  const signalRef = useRef<string>('')
  const triggerRef = useRef<number>(rollTrigger)

  const bucketScene = useGLTF(BUCKET_MODEL_PATH).scene
  const diceScene = useGLTF(DICE_MODEL_PATH).scene

  const normalizedBucket = useMemo(() => normalizeModel(bucketScene, { x: 0.42, y: 0.28, z: 0.42 }), [bucketScene])
  const normalizedDice = useMemo(() => normalizeModel(diceScene, { x: 0.18, y: 0.18, z: 0.18 }), [diceScene])

  useEffect(() => {
    const hasDiceResult = gameState.turn.diceResult !== null
    const triggerChanged = rollTrigger !== triggerRef.current

    triggerRef.current = rollTrigger

    if (!hasDiceResult || !triggerChanged) {
      signalRef.current = rollSignal
      phaseRef.current = 'idle'
      phaseStartRef.current = -1
      return
    }

    signalRef.current = rollSignal
    phaseRef.current = 'appearing'
    phaseStartRef.current = -1
  }, [gameState.turn.diceResult, rollSignal, rollTrigger])

  useFrame((state) => {
    if (!diceBox || phaseRef.current === 'idle') {
      return
    }

    if (phaseStartRef.current < 0) {
      phaseStartRef.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - phaseStartRef.current
    const centerX = (diceBox.minX + diceBox.maxX) / 2
    const centerY = diceBox.minY
    const centerZ = (diceBox.minZ + diceBox.maxZ) / 2
    const liftHeight = 0.38
    const shakeAmount = 0.02
    const shakeRotation = 0.14

    const appearedAt = PHASE_DURATIONS.appearing
    const shookAt = appearedAt + PHASE_DURATIONS.shaking
    const liftedAt = shookAt + PHASE_DURATIONS.lifting
    const revealedAt = liftedAt + PHASE_DURATIONS.revealing

    let nextPhase: DiceAnimationPhase = phaseRef.current
    if (elapsed < appearedAt) {
      nextPhase = 'appearing'
    } else if (elapsed < shookAt) {
      nextPhase = 'shaking'
    } else if (elapsed < liftedAt) {
      nextPhase = 'lifting'
    } else if (elapsed < revealedAt) {
      nextPhase = 'revealing'
    } else {
      nextPhase = 'finished'
    }

    phaseRef.current = nextPhase

    const bucket = bucketRef.current
    const dice = diceRef.current
    if (!bucket || !dice) {
      return
    }

    const appearOpacity = nextPhase === 'appearing' ? THREE.MathUtils.clamp(elapsed / appearedAt, 0, 1) : 1
    const revealOpacity = nextPhase === 'revealing'
      ? THREE.MathUtils.clamp((elapsed - liftedAt) / PHASE_DURATIONS.revealing, 0, 1)
      : nextPhase === 'finished'
        ? 1
        : 0

    const wobbleX = nextPhase === 'shaking' ? Math.sin(state.clock.elapsedTime * 22) * shakeAmount : 0
    const wobbleZ = nextPhase === 'shaking' ? Math.cos(state.clock.elapsedTime * 19) * shakeAmount * 0.8 : 0

    const bucketLift = nextPhase === 'lifting' || nextPhase === 'revealing' || nextPhase === 'finished'
      ? THREE.MathUtils.clamp((elapsed - shookAt) / PHASE_DURATIONS.lifting, 0, 1)
      : 0

    const diceReveal = nextPhase === 'revealing' || nextPhase === 'finished'
      ? THREE.MathUtils.clamp((elapsed - liftedAt) / PHASE_DURATIONS.revealing, 0, 1)
      : 0

    bucket.position.set(
      centerX + wobbleX,
      centerY + liftHeight * bucketLift,
      centerZ + wobbleZ,
    )
    bucket.rotation.set(
      Math.sin(state.clock.elapsedTime * 14) * shakeRotation * (nextPhase === 'shaking' ? 1 : 0.2),
      diceBox.rotationY ?? 0,
      Math.cos(state.clock.elapsedTime * 11) * shakeRotation * (nextPhase === 'shaking' ? 1 : 0.2),
    )

    dice.position.set(
      centerX + wobbleX * 0.4,
      centerY + 0.004,
      centerZ + wobbleZ * 0.35,
    )
    dice.rotation.set(
      Math.sin(state.clock.elapsedTime * 9) * 0.15 * (nextPhase === 'shaking' ? 1 : 0.15),
      resultToRotationY(rollResult),
      Math.cos(state.clock.elapsedTime * 8) * 0.15 * (nextPhase === 'shaking' ? 1 : 0.15),
    )

    setOpacity(bucket, appearOpacity)
    setOpacity(dice, revealOpacity)
  })

  if (!diceBox || gameState.turn.diceResult === null) {
    return null
  }

  return (
    <group>
      <group ref={bucketRef}>
        <primitive object={normalizedBucket} />
      </group>

      <group ref={diceRef}>
        <primitive object={normalizedDice} />
      </group>
    </group>
  )
}

useGLTF.preload(BUCKET_MODEL_PATH)
useGLTF.preload(DICE_MODEL_PATH)
