import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProgress } from '@react-three/drei'
import BoardScene, { type CameraDebugInfo } from '../scenes/BoardScene'
import { BoardLayoutData, createInitialEditorState, EditorMode } from '../utils/boardEditorState'
import { BoardEditorControls } from '../components/BoardEditor'
import getMockSnapshot from '../mock/getMockSnapshot'
import { rollMockTurn, resolveMockTurn } from '../mock/mockGameEngine'
import type { GameState, LegalMove } from '@rune-race/shared'

function LoadingOverlay({ active, progress }: { active: boolean; progress: number }) {
  if (!active) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/80 px-6 py-5 text-slate-100 shadow-xl">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-400 border-t-cyan-300" />
        <p className="text-sm font-medium">Loading board... {Math.round(progress)}%</p>
      </div>
    </div>
  )
}

function DevMenu({ info, tab, onTabChange, isEditorActive, onToggleEditor, cursorPos }: { info: CameraDebugInfo | null; tab: string; onTabChange: (tab: string) => void; isEditorActive: boolean; onToggleEditor: () => void; cursorPos: { x: number; y: number } | null }) {
  if (tab === 'camera') {
    if (!info) {
      return (
        <div className="rounded-xl border border-white/15 bg-slate-950/80 px-4 py-3 text-xs text-slate-200 backdrop-blur-sm">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => onTabChange('camera')}
              className="px-2 py-1 bg-cyan-600 rounded text-xs"
            >
              Camera
            </button>
            <button
              onClick={() => onTabChange('editor')}
              className="px-2 py-1 bg-gray-600 rounded text-xs"
            >
              Editor
            </button>
          </div>
          Waiting for camera data...
        </div>
      )
    }

    return (
      <div className="w-[300px] rounded-xl border border-white/15 bg-slate-950/85 p-4 text-xs text-slate-100 shadow-2xl backdrop-blur-sm">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => onTabChange('camera')}
            className="px-2 py-1 bg-cyan-600 rounded text-xs"
          >
            Camera
          </button>
          <button
            onClick={() => onTabChange('editor')}
            className="px-2 py-1 bg-gray-600 rounded text-xs"
          >
            Editor
          </button>
        </div>
        <p className="text-sm font-semibold text-cyan-300">Dev Camera Menu</p>
        <p className="mt-1 text-[11px] text-slate-400">Toggle: F3</p>
        <div className="mt-3 space-y-1 font-mono">
          <p>
            Position: [{info.position.x}, {info.position.y}, {info.position.z}]
          </p>
          <p>
            Rotation(deg): [{info.rotationDeg.x}, {info.rotationDeg.y}, {info.rotationDeg.z}]
          </p>
          <p>
            Target: [{info.target.x}, {info.target.y}, {info.target.z}]
          </p>
          <p>Distance to target: {info.distanceToTarget}</p>
          <p>FOV: {info.fov ?? 'n/a'}</p>
          <p>Zoom: {info.zoom}</p>
          <p>Near/Far: {info.near} / {info.far}</p>
          <p>Polar angle(deg): {info.polarAngleDeg ?? 'n/a'}</p>
          <p>Azimuth angle(deg): {info.azimuthAngleDeg ?? 'n/a'}</p>
          <p>DPR: {info.dpr}</p>
          <p>Cursor: {cursorPos ? `${cursorPos.x}, ${cursorPos.y}` : 'n/a'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[320px] rounded-xl border border-white/15 bg-slate-950/85 p-4 text-xs text-slate-100 shadow-2xl backdrop-blur-sm">
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => onTabChange('camera')}
          className="px-2 py-1 bg-gray-600 rounded text-xs"
        >
          Camera
        </button>
        <button
          onClick={() => onTabChange('editor')}
          className="px-2 py-1 bg-green-600 rounded text-xs"
        >
          Editor
        </button>
      </div>
      <p className="text-sm font-semibold text-green-300">Board Editor Controls</p>
      <p className="mt-1 text-[11px] text-slate-400">Toggle: F3</p>
      <div className="mt-3 space-y-1">
        <p>Click: Add step</p>
        <p>Delete: Remove last point</p>
        <p>Tab: Switch mode</p>
        <p className="mt-2 text-[11px] text-slate-500">Editor mode active - camera unrestricted</p>
      </div>
      <div className="mt-3">
        <button
          onClick={onToggleEditor}
          className={`mt-2 inline-flex items-center rounded-lg border px-3 py-1 text-sm font-semibold ${isEditorActive ? 'bg-green-700 text-white' : 'bg-black/30 text-white'}`}>
          {isEditorActive ? 'Editor ON' : 'Editor OFF'}
        </button>
      </div>
    </div>
  )
}

export default function GamePage() {
  const { active, progress } = useProgress()
  const [showDevMenu, setShowDevMenu] = useState(false)
  const [devMenuTab, setDevMenuTab] = useState('camera')
  const [cameraDebugInfo, setCameraDebugInfo] = useState<CameraDebugInfo | null>(null)
  const [isEditorActive, setIsEditorActive] = useState(false)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [editorData, setEditorData] = useState<BoardLayoutData>(createInitialEditorState().data)
  const [editorMode, setEditorMode] = useState<EditorMode>('main-track')
  const [editorSelectedPlayer, setEditorSelectedPlayer] = useState(0)
  const [editorMouseMode, setEditorMouseMode] = useState<'draw' | 'camera'>('draw')
  const [gameState, setGameState] = useState<GameState>(() => {
    return getMockSnapshot()
  })
  const [rollTrigger, setRollTrigger] = useState(0)
  const resolveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const finishOrder = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []

    gameState.events.forEach((event) => {
      if (event.type !== 'token_finished') {
        return
      }

      const playerId = typeof event.details?.playerId === 'string' ? event.details.playerId : ''
      if (!playerId || seen.has(playerId)) {
        return
      }

      seen.add(playerId)
      order.push(playerId)
    })

    return order
      .map((playerId) => gameState.players.find((player) => player.id === playerId))
      .filter((player): player is NonNullable<typeof player> => Boolean(player))
  }, [gameState.events, gameState.players])

  const legalMoveLabel = (move: LegalMove) => {
    const tokenIndex = Number(move.tokenId.split(':').pop() ?? '0') + 1
    if (move.moveType === 'spawn') {
      return `Xuat quan #${tokenIndex}`
    }

    if (move.moveType === 'capture') {
      return `Di quan #${tokenIndex} va an quan`
    }

    return `Di quan #${tokenIndex}`
  }

  // Attempt to auto-load board-layout.json from source data if present
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // dynamic import will resolve the JSON at build time if present
        const mod = await import('../../data/board-layout.json')
        const loaded = (mod && (mod.default ?? mod)) as BoardLayoutData
        if (!mounted) return
        // basic validation: prefer to set only if structure seems valid
        if (loaded && loaded.mainTrack && Array.isArray(loaded.mainTrack)) {
          setEditorData(loaded)
        }
      } catch (err) {
        // not present or failed to parse - ignore silently
        // console.warn('No board-layout.json found in data folder or failed to load.', err)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F3') {
        return
      }

      event.preventDefault()
      setShowDevMenu((current) => !current)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!showDevMenu) return
    const onMouseMove = (e: MouseEvent) => setCursorPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [showDevMenu])

  const handleToggleEditor = () => {
    setIsEditorActive(!isEditorActive)
    if (!isEditorActive) {
      setDevMenuTab('editor')
    }
  }

  const handleEditorExport = (json: string) => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'board-layout.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRollDice = () => {
    setGameState((current) => rollMockTurn(current))
    setRollTrigger((current) => current + 1)
  }

  const handleChooseMove = (moveId: string) => {
    setGameState((current) => resolveMockTurn(current, moveId))
  }

  useEffect(() => {
    if (resolveTimerRef.current) {
      window.clearTimeout(resolveTimerRef.current)
      resolveTimerRef.current = null
    }

    if (gameState.turn.phase !== 'rolled' || gameState.turn.diceResult === null) {
      return
    }

    resolveTimerRef.current = window.setTimeout(() => {
      setGameState((current) => resolveMockTurn(current))
      resolveTimerRef.current = null
    }, 4100)

    return () => {
      if (resolveTimerRef.current) {
        window.clearTimeout(resolveTimerRef.current)
        resolveTimerRef.current = null
      }
    }
  }, [gameState.turn.diceResult, gameState.turn.phase])

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      <BoardScene
        onDebugInfoChange={setCameraDebugInfo}
        isEditorActive={isEditorActive}
        gameState={gameState}
        rollTrigger={rollTrigger}
        editorData={editorData}
        editorMode={editorMode}
        editorSelectedPlayer={editorSelectedPlayer}
        onEditorDataChange={setEditorData}
        editorMouseMode={editorMouseMode}
        setEditorMouseMode={setEditorMouseMode}
      />

      <div className="absolute left-4 top-4 z-30">
        <Link
          to="/"
          className="inline-flex items-center rounded-lg border border-white/20 bg-black/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/50"
        >
          Back
        </Link>
      </div>

      <div className="absolute left-4 top-16 z-30">
        <button
          disabled={gameState.turn.phase !== 'waiting_roll'}
          onClick={handleRollDice}
          className="inline-flex items-center rounded-lg border border-amber-300/35 bg-amber-400/20 px-4 py-2 text-sm font-semibold text-amber-50 backdrop-blur-sm transition hover:bg-amber-300/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tung xúc xắc
        </button>
        <div className="mt-2 rounded-lg border border-white/10 bg-slate-950/65 px-3 py-2 text-xs text-slate-200 backdrop-blur-sm">
          <div>Current player: {gameState.players[gameState.currentPlayerIndex]?.name ?? 'n/a'}</div>
          <div>Turn phase: {gameState.turn.phase}</div>
          <div>Dice: {gameState.turn.diceResult ?? '-'}</div>
        </div>

        {gameState.turn.phase === 'waiting_choice' && gameState.turn.legalMoves.length > 1 ? (
          <div className="mt-2 w-[280px] rounded-lg border border-white/15 bg-slate-900/90 p-3 text-xs text-slate-100 backdrop-blur-sm">
            <div className="mb-2 text-sm font-semibold text-amber-200">Chon nuoc di</div>
            <div className="space-y-2">
              {gameState.turn.legalMoves.map((move) => (
                <button
                  key={move.id}
                  onClick={() => handleChooseMove(move.id)}
                  className="w-full rounded-md border border-amber-300/30 bg-amber-500/15 px-2 py-1 text-left text-amber-50 transition hover:bg-amber-400/25"
                >
                  {legalMoveLabel(move)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="absolute left-4 top-[240px] z-30 w-[240px] rounded-lg border border-white/15 bg-slate-900/80 px-3 py-3 text-xs text-slate-100 backdrop-blur-sm">
        <div className="mb-2 text-sm font-semibold text-emerald-200">Thu tu ve dich</div>
        {finishOrder.length === 0 ? (
          <div className="text-slate-300">Chua co nguoi ve dich</div>
        ) : (
          <div className="space-y-1">
            {finishOrder.map((player, index) => (
              <div key={player.id} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 py-1">
                <span>#{index + 1}</span>
                <span>{player.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor toggle moved into DevMenu; only visible when DevMenu open */}

      {showDevMenu ? (
        <div className="absolute right-4 top-4 z-30">
          <DevMenu info={cameraDebugInfo} tab={devMenuTab} onTabChange={setDevMenuTab} isEditorActive={isEditorActive} onToggleEditor={handleToggleEditor} cursorPos={cursorPos} />
        </div>
      ) : null}

      <BoardEditorControls
        isActive={isEditorActive}
        data={editorData}
        mode={editorMode}
        selectedPlayer={editorSelectedPlayer}
        onModeChange={setEditorMode}
        onPlayerChange={setEditorSelectedPlayer}
        onDataChange={setEditorData}
        onExport={handleEditorExport}
        onClose={() => setIsEditorActive(false)}
        onClear={() => {
          const initial = createInitialEditorState().data
          setEditorData(initial)
        }}
        editorMouseMode={editorMouseMode}
        setEditorMouseMode={setEditorMouseMode}
      />

      <LoadingOverlay active={active} progress={progress} />
    </div>
  )
}
