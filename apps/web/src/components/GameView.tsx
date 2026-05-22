import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProgress } from '@react-three/drei'
import BoardScene, { type CameraDebugInfo } from '../scenes/BoardScene'
import { BoardLayoutData, createInitialEditorState, EditorMode } from '../utils/boardEditorState'
import { BoardEditorControls } from '../components/BoardEditor'
import type { GameState, LegalMove } from '@rune-race/shared'
import { extractDiceResultFromEvents } from '../lib/dicePresentation'

function LoadingOverlay({ active, progress }: { active: boolean; progress: number }) {
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/80 px-6 py-5 text-slate-100 shadow-xl">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-400 border-t-cyan-300" />
        <p className="text-sm font-medium">Loading board... {Math.round(progress)}%</p>
      </div>
    </div>
  )
}

function DevMenu({
  info,
  tab,
  isEditorActive,
  onToggleEditor,
  gameState,
  debugMoves,
}: {
  info: CameraDebugInfo | null
  tab: string
  onTabChange: (tab: string) => void
  isEditorActive: boolean
  onToggleEditor: () => void
  cursorPos: { x: number; y: number } | null
  gameState: GameState
  selectableTokenIds: string[]
  debugMoves: Array<{ id: string; tokenId: string; label: string }>
}) {
  if (tab === 'camera') {
    if (!info) {
      return <div className="rounded-xl border border-white/15 bg-slate-950/80 px-4 py-3 text-xs text-slate-200">Waiting for camera...</div>
    }
    return (
      <div className="w-[300px] rounded-xl border border-white/15 bg-slate-950/85 p-4 text-xs text-slate-100 shadow-2xl backdrop-blur-sm font-mono space-y-1">
        <p className="text-cyan-300 font-semibold">Camera (F3)</p>
        <p>Pos: [{info.position.x}, {info.position.y}, {info.position.z}]</p>
      </div>
    )
  }

  if (tab === 'game') {
    return (
      <div className="w-[320px] rounded-xl border border-white/15 bg-slate-950/85 p-4 text-xs text-slate-100">
        <p>Phase: {gameState.turn.phase}</p>
        <p>Dice: {gameState.turn.diceResult ?? '-'}</p>
        {debugMoves.map((m) => (
          <div key={m.id}>{m.label}</div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-[320px] rounded-xl border border-white/15 bg-slate-950/85 p-4 text-xs text-slate-100">
      <button type="button" onClick={onToggleEditor} className="rounded-lg bg-green-700 px-3 py-1">
        {isEditorActive ? 'Editor ON' : 'Editor OFF'}
      </button>
    </div>
  )
}

export type GameViewProps = {
  gameState: GameState
  rollTrigger: number
  onRoll: () => void
  onSelectMove: (moveId: string) => void
  backHref?: string
  error?: string | null
  banner?: string | null
  canRoll?: boolean
  /** Local mock: auto-resolve after dice animation */
  autoResolveRolled?: boolean
  isPresentingDice?: boolean
  /** When set, move-selection arrows only show for this player (online). */
  localPlayerId?: string
}

export default function GameView({
  gameState,
  rollTrigger,
  onRoll,
  onSelectMove,
  backHref = '/',
  error,
  banner,
  canRoll = true,
  autoResolveRolled = false,
  isPresentingDice = false,
  localPlayerId,
}: GameViewProps) {
  const { active, progress } = useProgress()
  const [showDevMenu, setShowDevMenu] = useState(false)
  const [devMenuTab, setDevMenuTab] = useState('camera')
  const [cameraDebugInfo, setCameraDebugInfo] = useState<CameraDebugInfo | null>(null)
  const [isEditorActive, setIsEditorActive] = useState(false)
  const [cursorPos] = useState<{ x: number; y: number } | null>(null)
  const [editorData, setEditorData] = useState<BoardLayoutData>(createInitialEditorState().data)
  const [editorMode, setEditorMode] = useState<EditorMode>('main-track')
  const [editorSelectedPlayer, setEditorSelectedPlayer] = useState(0)
  const [editorMouseMode, setEditorMouseMode] = useState<'draw' | 'camera'>('draw')
  const resolveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const finishOrder = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []
    gameState.events.forEach((event) => {
      if (event.type !== 'token_finished') return
      const playerId = typeof event.details?.playerId === 'string' ? event.details.playerId : ''
      if (!playerId || seen.has(playerId)) return
      seen.add(playerId)
      order.push(playerId)
    })
    return order
      .map((id) => gameState.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
  }, [gameState.events, gameState.players])

  const legalMoveLabel = (move: LegalMove) => {
    const tokenIndex = Number(move.tokenId.split(':').pop() ?? '0') + 1
    if (move.moveType === 'spawn') return `Xuat quan #${tokenIndex}`
    if (move.moveType === 'capture') return `Di quan #${tokenIndex} va an quan`
    return `Di quan #${tokenIndex}`
  }

  const isLocalPlayersTurn =
    localPlayerId === undefined || gameState.turn.currentPlayerId === localPlayerId

  const isWaitingChoice =
    isLocalPlayersTurn &&
    !isPresentingDice &&
    gameState.turn.phase === 'waiting_choice' &&
    gameState.turn.legalMoves.length > 1

  const selectableTokenIds = useMemo(() => {
    if (!isWaitingChoice) return []
    const seen = new Set<string>()
    gameState.turn.legalMoves.forEach((m) => seen.add(m.tokenId))
    return Array.from(seen)
  }, [gameState.turn.legalMoves, isWaitingChoice])

  const moveIdByTokenId = useMemo(() => {
    const map = new Map<string, string>()
    gameState.turn.legalMoves.forEach((move) => {
      if (!map.has(move.tokenId)) map.set(move.tokenId, move.id)
    })
    return map
  }, [gameState.turn.legalMoves])

  const debugMoves = useMemo(
    () =>
      gameState.turn.legalMoves.map((move) => ({
        id: move.id,
        tokenId: move.tokenId,
        label: legalMoveLabel(move),
      })),
    [gameState.turn.legalMoves],
  )

  const myPlayer = gameState.players.find((p) => p.id === gameState.turn.currentPlayerId)
  const displayDice =
    extractDiceResultFromEvents(gameState.events) ?? gameState.turn.diceResult

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('../../data/board-layout.json')
        const loaded = (mod && (mod.default ?? mod)) as BoardLayoutData
        if (mounted && loaded?.mainTrack) setEditorData(loaded)
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault()
        setShowDevMenu((c) => !c)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!autoResolveRolled || isPresentingDice) return
    if (resolveTimerRef.current) {
      window.clearTimeout(resolveTimerRef.current)
      resolveTimerRef.current = null
    }
    if (gameState.turn.phase !== 'rolled' || gameState.turn.diceResult === null) return

    resolveTimerRef.current = window.setTimeout(() => {
      const first = gameState.turn.legalMoves[0]
      if (first) onSelectMove(first.id)
      else onSelectMove('')
      resolveTimerRef.current = null
    }, 0)

    return () => {
      if (resolveTimerRef.current) {
        window.clearTimeout(resolveTimerRef.current)
      }
    }
  }, [
    autoResolveRolled,
    isPresentingDice,
    gameState.turn.diceResult,
    gameState.turn.phase,
    gameState.turn.legalMoves,
    onSelectMove,
  ])

  const handleSelectToken = (tokenId: string) => {
    if (isPresentingDice || !isWaitingChoice) return
    const moveId = moveIdByTokenId.get(tokenId)
    if (moveId) onSelectMove(moveId)
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      <BoardScene
        onDebugInfoChange={setCameraDebugInfo}
        isEditorActive={isEditorActive}
        gameState={gameState}
        rollTrigger={rollTrigger}
        selectableTokenIds={selectableTokenIds}
        onSelectToken={handleSelectToken}
        freezeTokenAnimations={isPresentingDice}
        editorData={editorData}
        editorMode={editorMode}
        editorSelectedPlayer={editorSelectedPlayer}
        onEditorDataChange={setEditorData}
        editorMouseMode={editorMouseMode}
        setEditorMouseMode={setEditorMouseMode}
      />

      <div className="absolute left-4 top-4 z-30 flex flex-col gap-2">
        <Link
          to={backHref}
          className="inline-flex items-center rounded-lg border border-white/20 bg-black/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-black/50"
        >
          {gameState.status === 'finished' ? 'Ve lobby' : 'Back'}
        </Link>
        {banner ? (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/50 px-3 py-1 text-xs text-cyan-100">
            {banner}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-1 text-xs text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="absolute left-4 top-28 z-30">
        <button
          type="button"
          disabled={
            !canRoll ||
            isPresentingDice ||
            gameState.turn.phase !== 'waiting_roll' ||
            gameState.status === 'finished'
          }
          onClick={onRoll}
          className="inline-flex items-center rounded-lg border border-amber-300/35 bg-amber-400/20 px-4 py-2 text-sm font-semibold text-amber-50 backdrop-blur-sm hover:bg-amber-300/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tung xuc xac
        </button>
        <div className="mt-2 rounded-lg border border-white/10 bg-slate-950/65 px-3 py-2 text-xs text-slate-200 backdrop-blur-sm">
          <div>Lượt: {myPlayer?.name ?? 'n/a'}</div>
          <div>Phase: {gameState.turn.phase}</div>
          <div>Dice: {displayDice ?? '-'}</div>
          {gameState.status === 'finished' ? (
            <div className="mt-1 text-emerald-300">Game ket thuc</div>
          ) : null}
        </div>
      </div>

      <div className="absolute left-4 top-[240px] z-30 w-[240px] rounded-lg border border-white/15 bg-slate-900/80 px-3 py-3 text-xs text-slate-100 backdrop-blur-sm">
        <div className="mb-2 text-sm font-semibold text-emerald-200">Thu tu ve dich</div>
        {finishOrder.length === 0 ? (
          <div className="text-slate-300">Chua co nguoi ve dich</div>
        ) : (
          <div className="space-y-1">
            {finishOrder.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-2 py-1"
              >
                <span>#{index + 1}</span>
                <span>{player.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDevMenu ? (
        <div className="absolute right-4 top-4 z-30">
          <DevMenu
            info={cameraDebugInfo}
            tab={devMenuTab}
            onTabChange={setDevMenuTab}
            isEditorActive={isEditorActive}
            onToggleEditor={() => setIsEditorActive((v) => !v)}
            cursorPos={cursorPos}
            gameState={gameState}
            selectableTokenIds={selectableTokenIds}
            debugMoves={debugMoves}
          />
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
        onExport={(json) => {
          const blob = new Blob([json], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'board-layout.json'
          a.click()
          URL.revokeObjectURL(url)
        }}
        onClose={() => setIsEditorActive(false)}
        onClear={() => setEditorData(createInitialEditorState().data)}
        editorMouseMode={editorMouseMode}
        setEditorMouseMode={setEditorMouseMode}
      />

      <LoadingOverlay active={active} progress={progress} />
    </div>
  )
}
