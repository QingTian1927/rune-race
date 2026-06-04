import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { GameState } from '@rune-race/shared'
import {
  BUCKET_FADE_OUT_SECONDS,
  BUCKET_HOLD_AFTER_REVEAL_SECONDS,
  DICE_PHASE_DURATIONS,
} from '../lib/dicePresentation'
import boardLayout from '../../data/board-layout.json'
import { applyCartoonMaterialsToObject } from '../lib/sceneMaterials'
import type { GraphicsQuality } from '../lib/graphicsQuality'
import { getGraphicsQualityFlags } from '../lib/graphicsQuality'

type DiceAnimationPhase = 'idle' | 'appearing' | 'shaking' | 'lifting' | 'revealing' | 'finished'

interface DiceShakerProps {
  gameState: GameState
  rollTrigger: number
  shadowsEnabled?: boolean
  graphicsQuality?: GraphicsQuality
}

const BUCKET_MODEL_PATH = '/assets/models/bucket.glb'
const DICE_MODEL_PATH = '/assets/models/dice.glb'

const PHASE_DURATIONS = DICE_PHASE_DURATIONS

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

function normalizeModel(
  scene: THREE.Group,
  targetSize: { x: number; y: number; z: number },
  shadowsEnabled: boolean,
  cartoonMaterials: boolean,
  basicMaterials: boolean,
) {
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
  applyCartoonMaterialsToObject(clone, {
    variant: 'prop',
    castShadow: shadowsEnabled,
    cartoonMaterials,
    basicMaterials,
  })
  return clone
}

function normalizeCenteredModel(
  scene: THREE.Group,
  targetSize: { x: number; y: number; z: number },
  shadowsEnabled: boolean,
  cartoonMaterials: boolean,
  basicMaterials: boolean,
): { object: THREE.Group; halfHeight: number } {
  const clone = cloneModel(scene)
  const box = new THREE.Box3().setFromObject(clone)

  if (box.isEmpty()) {
    return { object: clone, halfHeight: 0 }
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

  clone.position.set(-center.x, -center.y, -center.z)
  const scaledSize = new THREE.Vector3()
  scaledBox.getSize(scaledSize)

  applyCartoonMaterialsToObject(clone, {
    variant: 'prop',
    castShadow: shadowsEnabled,
    cartoonMaterials,
    basicMaterials,
  })
  return { object: clone, halfHeight: scaledSize.y * 0.5 }
}

function setBucketPresentation(
  object: THREE.Object3D,
  opacity: number,
  shadowsEnabled: boolean,
) {
  const clamped = THREE.MathUtils.clamp(opacity, 0, 1)
  const visible = clamped > 0
  const fullOpacity = clamped >= 0.999

  object.scale.setScalar(
    !visible ? 0.0001 : fullOpacity ? 1 : Math.max(0.0001, clamped),
  )

  object.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) {
      return
    }

    const mesh = node as THREE.Mesh
    const applyMaterial = (material: THREE.Material) => {
      material.transparent = true
      material.opacity = clamped
      material.depthWrite = clamped >= 0.98
      material.needsUpdate = true
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(applyMaterial)
    } else if (mesh.material) {
      applyMaterial(mesh.material)
    }

    const cast = shadowsEnabled && visible
    mesh.castShadow = cast
    if (!cast || fullOpacity) {
      mesh.customDepthMaterial = undefined
      return
    }

    const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!sourceMaterial) {
      return
    }

    type DepthCache = { bucketDepth?: THREE.MeshDepthMaterial }
    const cache = sourceMaterial.userData as DepthCache
    if (!cache.bucketDepth) {
      cache.bucketDepth = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
      })
    }

    const depth = cache.bucketDepth
    depth.opacity = clamped
    depth.transparent = true
    depth.needsUpdate = true
    mesh.customDepthMaterial = depth
  })
}

function setOpacity(object: THREE.Object3D, opacity: number) {
  object.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) {
      return
    }

    const mesh = node as THREE.Mesh
    const applyMaterial = (material: THREE.Material) => {
      material.transparent = true
      material.opacity = opacity
      material.depthWrite = opacity >= 0.98
      material.needsUpdate = true
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
    return `${rollEvent.timestamp}`
  }

  return `${gameState.version}:${gameState.turn.diceResult ?? 'none'}`
}

function latestDiceRollResult(gameState: GameState): number | null {
  const rollEvent = [...gameState.events].reverse().find((event) => event.type === 'dice_roll')
  if (!rollEvent) {
    return gameState.turn.diceResult
  }

  const eventResult = Number(rollEvent.details?.result ?? NaN)
  if (Number.isFinite(eventResult) && eventResult >= 1 && eventResult <= 6) {
    return eventResult
  }

  return gameState.turn.diceResult
}

function getRestDieRotation(result: number): { x: number; y: number; z: number } {
  switch (((result - 1) % 6) + 1) {
    case 1:
      return { x: Math.PI, y: 0, z: 0 }
    // Adjusted mapping so the model's top face equals the rolled result.
    // Observed previous mapping: 1->1, 2->3, 3->5, 4->2, 5->4, 6->6.
    // New mapping uses the rotations that previously produced the desired top face.
    // Swap rotations for 2<->5 and 3<->4 to match the model's face mapping.
    case 2:
      return { x: 0, y: 0, z: Math.PI / 2 }
    case 3:
      return { x: -Math.PI / 2, y: 0, z: 0 }
    case 4:
      return { x: Math.PI / 2, y: 0, z: 0 }
    case 5:
      return { x: 0, y: 0, z: -Math.PI / 2 }
    default:
      return { x: 0, y: 0, z: 0 }
  }
}

export default function DiceShaker({
  gameState,
  rollTrigger,
  shadowsEnabled = true,
  graphicsQuality = 'high',
}: DiceShakerProps) {
  const { cartoonMaterials, basicMaterials } = getGraphicsQualityFlags(graphicsQuality)
  const layout = boardLayout as any
  const diceBox = layout?.dice ?? null
  const rollResult = latestDiceRollResult(gameState)
  const rollSignal = useMemo(() => latestDiceRollSignal(gameState), [gameState])

  const bucketRef = useRef<THREE.Group | null>(null)
  const diceRef = useRef<THREE.Group | null>(null)
  const diceVisualRef = useRef<THREE.Group | null>(null)
  const phaseRef = useRef<DiceAnimationPhase>('idle')
  const phaseStartRef = useRef<number>(-1)
  const signalRef = useRef<string>('')
  const triggerRef = useRef<number>(rollTrigger)

  const bucketScene = useGLTF(BUCKET_MODEL_PATH).scene
  const diceScene = useGLTF(DICE_MODEL_PATH).scene

  const normalizedBucket = useMemo(
    () =>
      normalizeModel(
        bucketScene,
        { x: 0.42, y: 0.28, z: 0.42 },
        shadowsEnabled,
        cartoonMaterials,
        basicMaterials,
      ),
    [bucketScene, shadowsEnabled, cartoonMaterials, basicMaterials],
  )
  const normalizedDice = useMemo(
    () =>
      normalizeCenteredModel(
        diceScene,
        { x: 0.16, y: 0.16, z: 0.16 },
        shadowsEnabled,
        cartoonMaterials,
        basicMaterials,
      ),
    [diceScene, shadowsEnabled, cartoonMaterials, basicMaterials],
  )
  const diceProbe = useMemo(() => normalizedDice.object.clone(true), [normalizedDice])

  useEffect(() => {
    const hasDiceResult = rollResult !== null
    const triggerChanged = rollTrigger !== triggerRef.current

    triggerRef.current = rollTrigger

    if (!hasDiceResult) {
      phaseRef.current = 'idle'
      phaseStartRef.current = -1
      return
    }

    if (!triggerChanged) {
      return
    }

    signalRef.current = rollSignal
    phaseRef.current = 'appearing'
    phaseStartRef.current = -1
  }, [rollResult, rollSignal, rollTrigger])

  useFrame((state) => {
    if (!diceBox) {
      return
    }

    const bucket = bucketRef.current
    const dice = diceRef.current
    const diceVisual = diceVisualRef.current
    if (!bucket || !dice || rollResult === null) {
      return
    }

    const centerX = (diceBox.minX + diceBox.maxX) / 2
    const centerY = diceBox.minY
    const centerZ = (diceBox.minZ + diceBox.maxZ) / 2
    const restDieRotation = getRestDieRotation(rollResult)

    if (phaseRef.current === 'idle') {
      bucket.position.set(centerX, centerY + 0.3, centerZ)
      bucket.rotation.set(0, diceBox.rotationY ?? 0, 0)
      dice.position.set(centerX, centerY, centerZ)
      if (diceVisual) {
        diceVisual.rotation.set(restDieRotation.x, restDieRotation.y, restDieRotation.z)
        diceProbe.rotation.copy(diceVisual.rotation)
        const restBounds = new THREE.Box3().setFromObject(diceProbe)
        if (!restBounds.isEmpty()) {
          diceVisual.position.set(0, -restBounds.min.y, 0)
        }
      }
      setBucketPresentation(bucket, 0, shadowsEnabled)
      setOpacity(dice, 1)
      return
    }

    if (phaseStartRef.current < 0) {
      phaseStartRef.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - phaseStartRef.current
    const liftHeight = 0.3
    const shakeAmount = 0.02
    const shakeRotation = 0.14

    const appearedAt = PHASE_DURATIONS.appearing
    const shookAt = appearedAt + PHASE_DURATIONS.shaking
    const liftedAt = shookAt + PHASE_DURATIONS.lifting
    const revealedAt = liftedAt + PHASE_DURATIONS.revealing
    const bucketHideAt = revealedAt + BUCKET_HOLD_AFTER_REVEAL_SECONDS

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

    const appearOpacity = nextPhase === 'appearing' ? THREE.MathUtils.clamp(elapsed / appearedAt, 0, 1) : 1
    const bucketOpacity =
      nextPhase === 'appearing'
        ? appearOpacity
        : elapsed < bucketHideAt
          ? 1
          : elapsed < bucketHideAt + BUCKET_FADE_OUT_SECONDS
            ? 1 - THREE.MathUtils.clamp((elapsed - bucketHideAt) / BUCKET_FADE_OUT_SECONDS, 0, 1)
            : 0
    const wobbleX = nextPhase === 'shaking' ? Math.sin(state.clock.elapsedTime * 22) * shakeAmount : 0
    const wobbleZ = nextPhase === 'shaking' ? Math.cos(state.clock.elapsedTime * 19) * shakeAmount * 0.8 : 0

    const settleProgress = nextPhase === 'lifting'
      ? THREE.MathUtils.clamp((elapsed - shookAt) / PHASE_DURATIONS.lifting, 0, 1)
      : nextPhase === 'revealing' || nextPhase === 'finished'
        ? 1
        : 0

    const bucketLift = nextPhase === 'revealing' || nextPhase === 'finished'
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
      centerX,
      centerY,
      centerZ,
    )
    if (diceVisual) {
      diceVisual.rotation.set(
        nextPhase === 'shaking'
          ? Math.sin(state.clock.elapsedTime * 9) * 0.15
          : THREE.MathUtils.lerp(Math.sin(state.clock.elapsedTime * 9) * 0.15 * 0.15, restDieRotation.x, settleProgress),
        nextPhase === 'shaking'
          ? Math.sin(state.clock.elapsedTime * 7) * 0.15
          : THREE.MathUtils.lerp(Math.sin(state.clock.elapsedTime * 7) * 0.15 * 0.15, restDieRotation.y, settleProgress),
        nextPhase === 'shaking'
          ? Math.cos(state.clock.elapsedTime * 8) * 0.15
          : THREE.MathUtils.lerp(Math.cos(state.clock.elapsedTime * 8) * 0.15 * 0.15, restDieRotation.z, settleProgress),
      )

      diceProbe.rotation.copy(diceVisual.rotation)
      const diceBounds = new THREE.Box3().setFromObject(diceProbe)
      if (!diceBounds.isEmpty()) {
        diceVisual.position.set(0, -diceBounds.min.y, 0)
      }
    }

    setBucketPresentation(bucket, bucketOpacity, shadowsEnabled)
    setOpacity(dice, 1)
  })

  if (!diceBox || rollResult === null) {
    return null
  }

  return (
    <group>
      <group ref={bucketRef}>
        <primitive object={normalizedBucket} />
      </group>

      <group ref={diceRef}>
        <group ref={diceVisualRef}>
          <primitive object={normalizedDice.object} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(BUCKET_MODEL_PATH)
useGLTF.preload(DICE_MODEL_PATH)
