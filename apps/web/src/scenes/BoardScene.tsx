import { Suspense, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import BoardModel from '../components/BoardModel'
import BoardPieces from '../components/BoardPieces'
import getMockSnapshot from '../mock/getMockSnapshot'
import { BoardEditorVisualization } from '../components/BoardEditorVisualization'
import { BoardEditorInputHandler } from '../components/BoardEditorInputHandler'
import { BoardLayoutData, EditorMode } from '../utils/boardEditorState'

export interface CameraDebugInfo {
  position: { x: number; y: number; z: number }
  rotationDeg: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number | null
  zoom: number
  near: number
  far: number
  distanceToTarget: number
  polarAngleDeg: number | null
  azimuthAngleDeg: number | null
  dpr: number
}

interface BoardSceneProps {
  onDebugInfoChange?: (info: CameraDebugInfo) => void
  isEditorActive?: boolean
  editorData?: BoardLayoutData
  editorMode?: EditorMode
  editorSelectedPlayer?: number
  onEditorDataChange?: (data: BoardLayoutData) => void
  editorMouseMode?: 'draw' | 'camera'
  setEditorMouseMode?: (v: 'draw' | 'camera') => void
}

const CAMERA_CONFIG = {
  position: [-0.857, 4.265, 8.462] as [number, number, number],
  target: [-0.741, -0.904, 0.582] as [number, number, number],
  fov: 34,
  near: 0.1,
  far: 200,
  minDistance: 7,
  maxDistance: 9.425,
  nearInteractionDistance: 9.425,
  rotateSpeed: 0.45,
  zoomSpeed: 0.45,
  panSpeed: 0.55,
  panBounds: {
    minX: -1.849,
    maxX: 0.515,
    minY: -1.481,
    maxY: 0.81,
    minZ: -0.537,
    maxZ: 0.96,
  },
  // when tilt is maximized (top pan), do not allow target.y below this value
  panWhenMaxTiltMinY: -0.653,
  // safe global tilt bounds (radians)
  globalMinPolar: 0.6,
  globalMaxPolar: 1.1,
  topPanMaxPolarDeg: 86.9,
}

function toFixedNumber(value: number, digits = 3): number {
  return Number(value.toFixed(digits))
}

function radToDeg(value: number): number {
  return value * (180 / Math.PI)
}

function CameraDebugReporter({
  controlsRef,
  onDebugInfoChange,
}: {
  controlsRef: React.MutableRefObject<any>
  onDebugInfoChange?: (info: CameraDebugInfo) => void
}) {
  const { camera, gl } = useThree()
  const lastEmitRef = useRef(0)

  useFrame((state) => {
    if (!onDebugInfoChange) {
      return
    }

    const now = state.clock.elapsedTime * 1000
    if (now - lastEmitRef.current < 100) {
      return
    }
    lastEmitRef.current = now

    const target = controlsRef.current?.target ?? new THREE.Vector3(0, 0, 0)
    const isPerspectiveCamera = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
    const perspectiveCamera = isPerspectiveCamera ? (camera as THREE.PerspectiveCamera) : null

    onDebugInfoChange({
      position: {
        x: toFixedNumber(camera.position.x),
        y: toFixedNumber(camera.position.y),
        z: toFixedNumber(camera.position.z),
      },
      rotationDeg: {
        x: toFixedNumber(radToDeg(camera.rotation.x), 2),
        y: toFixedNumber(radToDeg(camera.rotation.y), 2),
        z: toFixedNumber(radToDeg(camera.rotation.z), 2),
      },
      target: {
        x: toFixedNumber(target.x),
        y: toFixedNumber(target.y),
        z: toFixedNumber(target.z),
      },
      fov: perspectiveCamera ? toFixedNumber(perspectiveCamera.fov, 2) : null,
      zoom: toFixedNumber(camera.zoom, 3),
      near: toFixedNumber(camera.near, 3),
      far: toFixedNumber(camera.far, 3),
      distanceToTarget: toFixedNumber(camera.position.distanceTo(target), 3),
      polarAngleDeg:
        typeof controlsRef.current?.getPolarAngle === 'function'
          ? toFixedNumber(radToDeg(controlsRef.current.getPolarAngle()), 2)
          : null,
      azimuthAngleDeg:
        typeof controlsRef.current?.getAzimuthalAngle === 'function'
          ? toFixedNumber(radToDeg(controlsRef.current.getAzimuthalAngle()), 2)
          : null,
      dpr: toFixedNumber(gl.getPixelRatio(), 2),
    })
  })

  return null
}

function AdaptiveControlsBehavior({ controlsRef, isEditorActive }: { controlsRef: React.MutableRefObject<any>, isEditorActive?: boolean }) {
  const { camera } = useThree()
  const lastClampedTargetRef = useRef<THREE.Vector3 | null>(null)

  function clampTarget(target: THREE.Vector3) {
    return new THREE.Vector3(
      THREE.MathUtils.clamp(target.x, CAMERA_CONFIG.panBounds.minX, CAMERA_CONFIG.panBounds.maxX),
      THREE.MathUtils.clamp(target.y, CAMERA_CONFIG.panBounds.minY, CAMERA_CONFIG.panBounds.maxY),
      THREE.MathUtils.clamp(target.z, CAMERA_CONFIG.panBounds.minZ, CAMERA_CONFIG.panBounds.maxZ),
    )
  }

  useFrame(() => {
    // Skip constraints when editor is active
    if (isEditorActive) {
      return
    }

    const controls = controlsRef.current
    if (!controls) {
      return
    }

    const target = controls.target ?? new THREE.Vector3(0, 0, 0)
    const clampedTarget = clampTarget(target)

    // Dynamically clamp the maximum polar angle (tilt down limit) based on how far up the camera is panned.
    const topLimitRad = (CAMERA_CONFIG.topPanMaxPolarDeg * Math.PI) / 180
    const minY = CAMERA_CONFIG.panBounds.minY
    const maxY = CAMERA_CONFIG.panBounds.maxY
    const t = maxY === minY ? 0 : THREE.MathUtils.clamp((clampedTarget.y - minY) / (maxY - minY), 0, 1)
    // interpolate between globalMaxPolar (when at bottom) and topLimitRad (when at top)
    const rawDesired = THREE.MathUtils.lerp(CAMERA_CONFIG.globalMaxPolar, topLimitRad, t)
    // clamp desired into safe global bounds
    const desiredMaxPolar = THREE.MathUtils.clamp(rawDesired, CAMERA_CONFIG.globalMinPolar, CAMERA_CONFIG.globalMaxPolar)

    // If tilt is at its top limit, enforce a lower bound for pan (target.y)
    const EPS = 1e-3
    if (desiredMaxPolar <= topLimitRad + EPS) {
      clampedTarget.y = Math.max(clampedTarget.y, CAMERA_CONFIG.panWhenMaxTiltMinY)
    }

    if (controls.maxPolarAngle !== desiredMaxPolar || controls.minPolarAngle !== CAMERA_CONFIG.globalMinPolar) {
      controls.maxPolarAngle = desiredMaxPolar
      controls.minPolarAngle = CAMERA_CONFIG.globalMinPolar
      controls.update()
    }

    if (!target.equals(clampedTarget)) {
      const delta = clampedTarget.clone().sub(target)
      camera.position.add(delta)
      target.copy(clampedTarget)
      controls.target.copy(clampedTarget)
      controls.update()
      lastClampedTargetRef.current = clampedTarget
    } else if (lastClampedTargetRef.current && !lastClampedTargetRef.current.equals(clampedTarget)) {
      lastClampedTargetRef.current = clampedTarget
    }
  })

  return null
}

function EditorVisualizationWrapper({
  isActive,
  data,
  mode,
  selectedPlayer,
  onDataChange,
  hoverPos,
  onHoverChange,
  previewBox,
  onPreviewBoxChange,
  editorMouseMode,
  setEditorMouseMode,
}: {
  isActive?: boolean
  data?: BoardLayoutData
  mode?: EditorMode
  selectedPlayer?: number
  onDataChange?: (data: BoardLayoutData) => void
  hoverPos?: { x: number; y: number; z: number } | null
  onHoverChange?: (pos: { x: number; y: number; z: number } | null) => void
  previewBox?: any | null
  onPreviewBoxChange?: (box: any | null) => void
  editorMouseMode?: 'draw' | 'camera'
  setEditorMouseMode?: (v: 'draw' | 'camera') => void
}) {
  if (!isActive || !data || !mode) {
    return null
  }

  return (
    <>
      <BoardEditorVisualization
        isActive={isActive}
        data={data}
        mode={mode}
        selectedPlayer={selectedPlayer || 0}
        hoverPos={hoverPos ?? null}
        previewBox={previewBox ?? null}
      />
      <BoardEditorInputHandler
        isActive={isActive}
        data={data}
        mode={mode}
        selectedPlayer={selectedPlayer || 0}
        onDataChange={onDataChange || (() => {})}
        onHoverChange={onHoverChange}
        onPreviewBoxChange={onPreviewBoxChange}
        editorMouseMode={editorMouseMode}
        setEditorMouseMode={setEditorMouseMode}
      />
    </>
  )
}

export default function BoardScene({
  onDebugInfoChange,
  isEditorActive = false,
  editorData,
  editorMode = 'main-track',
  editorSelectedPlayer = 0,
  onEditorDataChange,
  editorMouseMode,
  setEditorMouseMode,
}: BoardSceneProps) {
  const controlsRef = useRef<any>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number; z: number } | null>(null)
  const [previewBox, setPreviewBox] = useState<any | null>(null)

  const mockSnapshot = useMemo(() => getMockSnapshot(), [])

  return (
    <Canvas dpr={[1, 1.75]} className="h-full w-full">
      <color attach="background" args={['#0b162b']} />

      <PerspectiveCamera
        makeDefault
        position={CAMERA_CONFIG.position}
        fov={CAMERA_CONFIG.fov}
        near={CAMERA_CONFIG.near}
        far={CAMERA_CONFIG.far}
      />

      <Suspense fallback={null}>
        <BoardModel />
        <BoardPieces gameState={mockSnapshot} />
      </Suspense>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} userData={{ editorInteractionSurface: true }}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[42, 42]} />
        <meshBasicMaterial color="#0f243f" />
      </mesh>

      <CameraDebugReporter controlsRef={controlsRef} onDebugInfoChange={onDebugInfoChange} />
      <AdaptiveControlsBehavior controlsRef={controlsRef} isEditorActive={isEditorActive} />

      <OrbitControls
        ref={controlsRef}
        target={CAMERA_CONFIG.target}
        enablePan={isEditorActive ? (editorMouseMode === 'camera') : true}
        enableZoom
        enableRotate={isEditorActive ? (editorMouseMode === 'camera') : true}
        rotateSpeed={CAMERA_CONFIG.rotateSpeed}
        zoomSpeed={CAMERA_CONFIG.zoomSpeed}
        panSpeed={CAMERA_CONFIG.panSpeed}
        minDistance={isEditorActive ? 0.1 : CAMERA_CONFIG.minDistance}
        maxDistance={isEditorActive ? 1000 : CAMERA_CONFIG.maxDistance}
        minPolarAngle={isEditorActive ? 0.01 : 0.01}
        maxPolarAngle={isEditorActive ? Math.PI - 0.01 : Math.PI - 0.01}
      />

      <EditorVisualizationWrapper
        isActive={isEditorActive}
        data={editorData}
        mode={editorMode}
        selectedPlayer={editorSelectedPlayer}
        onDataChange={onEditorDataChange}
        hoverPos={hoverPos}
        onHoverChange={setHoverPos}
        previewBox={previewBox}
        onPreviewBoxChange={setPreviewBox}
        editorMouseMode={editorMouseMode}
        setEditorMouseMode={setEditorMouseMode}
      />
    </Canvas>
  )
}
