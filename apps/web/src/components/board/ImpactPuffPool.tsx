import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createImpactPuffId,
  IMPACT_PUFF_CONFIG,
  POOL_SIZE,
  puffOpacity,
  puffProgress,
  puffSphereOffset,
  type ActiveImpactPuff,
  type BoardImpactFeedback,
  type ImpactPuffKind,
} from '../../lib/boardImpact'

export type SpawnImpactPuff = (
  position: THREE.Vector3,
  kind: ImpactPuffKind,
  meta?: { tokenId?: string; playerIndex?: number },
) => void

type ImpactPuffPoolProps = {
  feedback?: BoardImpactFeedback
  onSpawnReady?: (spawn: SpawnImpactPuff) => void
}

function PuffVisual({ puff }: { puff: ActiveImpactPuff }) {
  const groupRef = useRef<THREE.Group>(null)
  const config = IMPACT_PUFF_CONFIG[puff.kind]
  const sphereMeshes = useRef<THREE.Mesh[]>([])
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!groupRef.current) return

    const elapsedMs = performance.now() - puff.startTime
    const progress = puffProgress(elapsedMs, config.durationMs)

    groupRef.current.position.copy(puff.position)

    const opacityMul = config.opacityMul ?? 1
    const radiusMul = config.radiusMul ?? 1

    const ringScale = 0.35 + progress * config.ringScaleEnd
    if (ringRef.current) {
      ringRef.current.scale.set(ringScale, ringScale, 1)
      const ringMat = ringRef.current.material as THREE.MeshBasicMaterial
      ringMat.opacity = puffOpacity(progress, 'ring', opacityMul)
    }

    sphereMeshes.current.forEach((mesh, index) => {
      if (!mesh) return
      const offset = puffSphereOffset(index, config.sphereCount, progress, config.lift, radiusMul)
      mesh.position.copy(offset)
      const s = config.baseScale * (1 + progress * 0.85)
      mesh.scale.setScalar(s)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = puffOpacity(progress, 'sphere', opacityMul)
    })
  })

  return (
    <group ref={groupRef}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.06, 0.11, 16]} />
        <meshBasicMaterial
          color={config.colors.ring}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {Array.from({ length: config.sphereCount }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            if (node) sphereMeshes.current[index] = node
          }}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial
            color={config.colors.core}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function ImpactPuffPool({ feedback, onSpawnReady }: ImpactPuffPoolProps) {
  const [activePuffs, setActivePuffs] = useState<ActiveImpactPuff[]>([])
  const feedbackRef = useRef(feedback)
  feedbackRef.current = feedback

  const spawn = useCallback<SpawnImpactPuff>((position, kind, meta) => {
    const fb = feedbackRef.current
    const event = {
      kind,
      position: position.clone(),
      tokenId: meta?.tokenId,
      playerIndex: meta?.playerIndex,
    }
    fb?.onImpact?.(event)

    if (fb?.reducedMotion) {
      return
    }

    const puff: ActiveImpactPuff = {
      id: createImpactPuffId(),
      kind,
      position: position.clone(),
      startTime: performance.now(),
    }

    setActivePuffs((current) => {
      const next = [...current, puff]
      if (next.length <= POOL_SIZE) {
        return next
      }
      return next.slice(next.length - POOL_SIZE)
    })
  }, [])

  useEffect(() => {
    onSpawnReady?.(spawn)
  }, [onSpawnReady, spawn])

  useFrame(() => {
    const now = performance.now()
    setActivePuffs((current) => {
      if (current.length === 0) return current
      const filtered = current.filter((puff) => {
        const duration = IMPACT_PUFF_CONFIG[puff.kind].durationMs
        return now - puff.startTime < duration + 40
      })
      return filtered.length === current.length ? current : filtered
    })
  })

  return (
    <group>
      {activePuffs.map((puff) => (
        <PuffVisual key={puff.id} puff={puff} />
      ))}
    </group>
  )
}
