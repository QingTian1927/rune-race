import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GameState, Token } from '@rune-race/shared'
import boardLayout from '../../data/board-layout.json'
import { loadPawnModel } from '../utils/pawnLoader'

interface BoardPiecesProps {
  gameState: GameState
  animationDurationMs?: number
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
  animationDurationMs = 300,
}: {
  token: Token
  playerIndex: number
  animationDurationMs?: number
}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const startRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const progressRef = useRef(1)
  const lastUpdateRef = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    loadPawnModel(playerIndex).then((g) => {
      if (!mounted) return
      const node = g.clone()
      if (groupRef.current) {
        groupRef.current.add(node)
      }
    })
    return () => {
      mounted = false
    }
  }, [playerIndex])

  useEffect(() => {
    // initialize positions when token mounts or changes
    if (!groupRef.current) return
    const cur = groupRef.current.position
    startRef.current.copy(cur)
    // compute target from token._targetPos (injected by parent)
    const t = (token as any)._targetPos as THREE.Vector3 | undefined
    if (t) {
      targetRef.current.copy(t)
    }
    progressRef.current = 0
    lastUpdateRef.current = null
  }, [token.id])

  useFrame((state) => {
    if (!groupRef.current) return
    const duration = Math.max(1, animationDurationMs) / 1000
    if (progressRef.current >= 1) return
    if (lastUpdateRef.current === null) lastUpdateRef.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - (lastUpdateRef.current ?? 0)
    const p = Math.min(1, elapsed / duration)
    const cur = new THREE.Vector3().lerpVectors(startRef.current, targetRef.current, p)
    groupRef.current.position.copy(cur)
    if (p >= 1) {
      progressRef.current = 1
    }
  })

  return <group ref={groupRef} />
}

export default function BoardPieces({ gameState, animationDurationMs = 300 }: BoardPiecesProps) {
  const layout = boardLayout as any
  const playerIndexById = useMemo(() => {
    const m: Record<string, number> = {}
    gameState.players.forEach((p, i) => (m[p.id] = i))
    return m
  }, [gameState.players])

  // Compute target positions for each token
  const tokensWithTargets = useMemo(() => {
    return gameState.tokens.map((t) => {
      const pi = playerIndexById[t.playerId]
      let pos = new THREE.Vector3()

      if (t.state === 'in_base') {
        const stable = layout.players[pi]?.stable
        if (stable) {
          const cols = 2
          const rows = 2
          const baseIndex = parseInt(t.id.split(':')[1], 10) % (cols * rows)
          const cx = (stable.minX + stable.maxX) / 2
          const cz = (stable.minZ + stable.maxZ) / 2
          const w = stable.maxX - stable.minX
          const d = stable.maxZ - stable.minZ
          const col = baseIndex % cols
          const row = Math.floor(baseIndex / cols)
          const x = cx + ( (col - (cols-1)/2) * (w * 0.28) )
          const z = cz + ( (row - (rows-1)/2) * (d * 0.28) )
          const y = stable.minY + (stable.maxY - stable.minY) * 0.12
          pos.set(x, y, z)
        }
      } else if (t.state === 'on_track') {
        const idx = Math.max(0, Math.min((layout.mainTrack.length || 0) - 1, t.position))
        const p = layout.mainTrack[idx]
        if (p) pos.copy(vecFrom(p))
      } else if (t.state === 'in_home_lane') {
        const hl = layout.players[pi]?.homeLane
        const idx = Math.max(0, Math.min((hl?.length || 0) - 1, t.position))
        const p = hl ? hl[idx] : null
        if (p) pos.copy(vecFrom(p))
      } else if (t.state === 'finished') {
        const home = layout.players[pi]?.home
        if (home) {
          const x = (home.minX + home.maxX) / 2
          const y = (home.minY + home.maxY) / 2
          const z = (home.minZ + home.maxZ) / 2
          pos.set(x, y, z)
        }
      }

      return Object.assign({}, t, { _targetPos: pos, _playerIndex: pi })
    })
  }, [gameState.tokens, layout, playerIndexById])

  return (
    <group>
      {/* Houses */}
      {gameState.players.map((p, i) => {
        const home = (layout.players && layout.players[i] && layout.players[i].home) || null
        return <HousePlaceholder key={`house-${p.id}`} box={home} color={PLAYER_COLOR_HEX[p.color] ?? '#ddd'} />
      })}

      {/* Pawns */}
      {tokensWithTargets.map((t: any) => (
        <group key={t.id}>
          <PawnInstance token={t} playerIndex={t._playerIndex ?? 0} animationDurationMs={animationDurationMs} />
        </group>
      ))}
    </group>
  )
}
