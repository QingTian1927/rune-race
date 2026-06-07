import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import type { PlayerColor, RuneTriggerMode } from '@rune-race/shared'

/** Tip of pin sits slightly above board mesh to avoid z-fighting. */
export const RUNE_MARKER_Y_OFFSET = 0.006

/** Same visual language as move selector / status icons on pawns. */
const MARKER_SCALE = 0.60
const BOARD_ICON_OPACITY = 0.95
const HEAD_FILL = '#f8fafc'

const BOARD_ICON_MATERIAL = {
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false,
} as const

const RING_LAY_FLAT: [number, number, number] = [-Math.PI / 2, 0, 0]

/** Cool vs warm so both read clearly on green grass / wood paths. */
const TRIGGER_RING_PASS_THROUGH = '#4690e8'
const TRIGGER_RING_EXACT_STOP = '#d06860'
const TRIGGER_RING_EXACT_DOT = '#b84842'

/** HUD / lobby player accents (skyColors PLAYER_GRADIENT). */
const PLAYER_PIN_HEX: Record<PlayerColor, string> = {
  red: '#FF6B60',
  blue: '#5BA8FF',
  green: '#4FC870',
  yellow: '#FFD740',
}

const TAIL_TOP_Y = 0.062
const TAIL_HALF_WIDTH = 0.044
const HEAD_GAP = 0.02
const HEAD_OUTER_R = 0.088
const HEAD_INNER_R = 0.072
const HEAD_Y = TAIL_TOP_Y + HEAD_GAP + HEAD_OUTER_R

/** Pin tail — downward triangle, tip anchored at cell center. */
const RUNE_PIN_TAIL = (() => {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(-TAIL_HALF_WIDTH, TAIL_TOP_Y)
  shape.lineTo(TAIL_HALF_WIDTH, TAIL_TOP_Y)
  shape.closePath()
  return shape
})()

/** Colored ring around the avatar head. */
const RUNE_PIN_HEAD_RING = (() => {
  const shape = new THREE.Shape()
  shape.absarc(0, HEAD_Y, HEAD_OUTER_R, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, HEAD_Y, HEAD_INNER_R, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  return shape
})()

const RUNE_PIN_HEAD_FILL = (() => {
  const shape = new THREE.Shape()
  shape.absarc(0, HEAD_Y, HEAD_INNER_R, 0, Math.PI * 2, false)
  return shape
})()

const avatarTextureCache = new Map<string, THREE.CanvasTexture>()

function getAvatarTexture(emoji: string): THREE.CanvasTexture {
  const key = emoji.trim()
  const cached = avatarTextureCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64)
    ctx.font = '48px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(key, 32, 34)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  avatarTextureCache.set(key, texture)
  return texture
}

type RuneMapPin3DProps = {
  color: PlayerColor
  avatarEmoji?: string | null
  ghost?: boolean
  triggerMode?: RuneTriggerMode | null
}

/** Flat on board (world XZ) — outside Billboard so rings stay circular. */
function TriggerModeGroundRing({
  triggerMode,
  ghost,
}: {
  triggerMode: RuneTriggerMode
  ghost?: boolean
}) {
  const y = 0.012
  const ringInner = 0.027
  const ringOuter = 0.033
  const ringOpacity = ghost ? 0.58 : 0.76

  if (triggerMode === 'PASS_THROUGH') {
    return (
      <group position={[0, y, 0]} rotation={RING_LAY_FLAT}>
        <mesh renderOrder={10}>
          <ringGeometry args={[ringInner, ringOuter, 32]} />
          <meshBasicMaterial
            color={TRIGGER_RING_PASS_THROUGH}
            transparent
            opacity={ringOpacity}
            depthWrite={false}
          />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[0, y, 0]} rotation={RING_LAY_FLAT}>
      <mesh renderOrder={10}>
        <ringGeometry args={[ringInner, ringOuter, 32]} />
        <meshBasicMaterial
          color={TRIGGER_RING_EXACT_STOP}
          transparent
          opacity={ringOpacity}
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={11}>
        <circleGeometry args={[0.004, 14]} />
        <meshBasicMaterial
          color={TRIGGER_RING_EXACT_DOT}
          transparent
          opacity={ghost ? 0.62 : 0.78}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export function RuneMapPin3D({ color, avatarEmoji, ghost = false, triggerMode = null }: RuneMapPin3DProps) {
  const pinRef = useRef<THREE.Group>(null)
  const pinColor = PLAYER_PIN_HEX[color]
  const emoji = avatarEmoji?.trim() ?? ''

  const avatarTexture = useMemo(
    () => (emoji ? getAvatarTexture(emoji) : null),
    [emoji],
  )

  useFrame((state) => {
    if (!ghost || !pinRef.current) return
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4.2) * 0.05
    pinRef.current.scale.setScalar(MARKER_SCALE * pulse)
  })

  return (
    <group>
      {triggerMode ? <TriggerModeGroundRing triggerMode={triggerMode} ghost={ghost} /> : null}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <group ref={pinRef} scale={[MARKER_SCALE, MARKER_SCALE, MARKER_SCALE]}>
          <mesh renderOrder={12}>
            <shapeGeometry args={[RUNE_PIN_TAIL]} />
            <meshBasicMaterial
              color={pinColor}
              opacity={ghost ? 0.78 : BOARD_ICON_OPACITY}
              {...BOARD_ICON_MATERIAL}
            />
          </mesh>
          <mesh renderOrder={13}>
            <shapeGeometry args={[RUNE_PIN_HEAD_RING]} />
            <meshBasicMaterial
              color={pinColor}
              opacity={ghost ? 0.82 : BOARD_ICON_OPACITY}
              {...BOARD_ICON_MATERIAL}
            />
          </mesh>
          <mesh renderOrder={14}>
            <shapeGeometry args={[RUNE_PIN_HEAD_FILL]} />
            <meshBasicMaterial
              color={HEAD_FILL}
              opacity={ghost ? 0.72 : 0.97}
              {...BOARD_ICON_MATERIAL}
            />
          </mesh>
          {avatarTexture ? (
            <mesh position={[0, HEAD_Y, 0.001]} renderOrder={15}>
              <planeGeometry args={[HEAD_INNER_R * 1.85, HEAD_INNER_R * 1.85]} />
              <meshBasicMaterial
                map={avatarTexture}
                transparent
                opacity={ghost ? 0.78 : 0.98}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ) : null}
        </group>
      </Billboard>
    </group>
  )
}
