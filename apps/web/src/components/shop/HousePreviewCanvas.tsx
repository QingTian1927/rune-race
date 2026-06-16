import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { HouseSkinId, PlayerColor } from '@rune-race/shared'
import { HousePreviewModel } from '../houses/HouseModel'

type HousePreviewCanvasProps = {
  skinId: HouseSkinId
  color: PlayerColor
}

export function HousePreviewCanvas({ skinId, color }: HousePreviewCanvasProps) {
  return (
    <div className="shop-preview-canvas">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        className="shop-preview-canvas__inner"
      >
        <color attach="background" args={['#e8e2d0']} />
        <PerspectiveCamera makeDefault position={[1.35, 0.95, 1.65]} fov={32} />
        <OrbitControls
          enablePan={false}
          minDistance={1.4}
          maxDistance={3.2}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0.22, 0]}
        />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 4, 2]} intensity={1.1} castShadow />
        <directionalLight position={[-2, 2.5, -1.5]} intensity={0.35} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <circleGeometry args={[1.1, 48]} />
          <meshStandardMaterial color="#cfc6ad" roughness={0.92} />
        </mesh>
        <Suspense fallback={null}>
          <group position={[0, 0.02, 0]}>
            <HousePreviewModel skinId={skinId} color={color} />
          </group>
        </Suspense>
      </Canvas>
    </div>
  )
}
