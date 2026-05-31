import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createCloudCluster } from './createCloudCluster'

type ClusterDef = {
  angle: number
  radius: number
  height: number
  scale: number
  driftSpeed: number
  phase: number
}

const CLUSTER_DEFS: ClusterDef[] = [
  { angle: 0.2, radius: 19, height: 7.5, scale: 1.05, driftSpeed: 0.045, phase: 0 },
  { angle: 1.4, radius: 21, height: 9.2, scale: 1.2, driftSpeed: 0.038, phase: 1.2 },
  { angle: 2.6, radius: 18, height: 8.4, scale: 0.95, driftSpeed: 0.05, phase: 2.4 },
  { angle: 3.8, radius: 22, height: 10.5, scale: 1.15, driftSpeed: 0.042, phase: 0.8 },
  { angle: 5.0, radius: 20, height: 7.8, scale: 1.0, driftSpeed: 0.048, phase: 3.1 },
  { angle: 0.9, radius: 24, height: 11.2, scale: 1.25, driftSpeed: 0.035, phase: 4.0 },
  { angle: 4.5, radius: 17, height: 6.8, scale: 0.88, driftSpeed: 0.052, phase: 1.7 },
]

type CloudClusterInstanceProps = ClusterDef

function CloudClusterInstance({ angle, radius, height, scale, driftSpeed, phase }: CloudClusterInstanceProps) {
  const rootRef = useRef<THREE.Group>(null)
  const basePosition = useMemo(() => {
    return new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
  }, [angle, height, radius])

  const cloud = useMemo(() => createCloudCluster(scale), [scale])

  useFrame((state) => {
    const root = rootRef.current
    if (!root) return

    const t = state.clock.elapsedTime
    const orbit = t * driftSpeed + phase
    root.position.set(
      basePosition.x + Math.sin(orbit) * 0.65,
      basePosition.y + Math.sin(t * 0.35 + phase) * 0.22,
      basePosition.z + Math.cos(orbit * 0.85) * 0.55,
    )
    root.rotation.y = Math.sin(orbit * 0.4) * 0.08
  })

  return (
    <group ref={rootRef}>
      <primitive object={cloud} />
    </group>
  )
}

export function CloudField() {
  return (
    <group name="cloud-field">
      {CLUSTER_DEFS.map((def, index) => (
        <CloudClusterInstance key={`cloud-${index}`} {...def} />
      ))}
    </group>
  )
}
