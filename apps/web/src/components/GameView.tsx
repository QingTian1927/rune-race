import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProgress } from '@react-three/drei'
import type { Player } from '@rune-race/shared'
import BoardScene, { type CameraDebugInfo } from '../scenes/BoardScene'
import { BoardLayoutData, createInitialEditorState, EditorMode } from '../utils/boardEditorState'
import { BoardEditorControls } from '../components/BoardEditor'
import type { GameState, LegalMove } from '@rune-race/shared'
import { CurrentTurnPanel } from './hud/CurrentTurnPanel'
import { MyPlayerPanel } from './hud/MyPlayerPanel'
import { FinishOrderPanel } from './hud/FinishOrderPanel'
import { YourTurnBanner } from './hud/YourTurnBanner'
import { RollDiceButton } from './hud/RollDiceButton'

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
  const bannerHideTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const rollShowTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const moveBannerTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const hudCommitTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const wasPresentingRef = useRef(isPresentingDice)
  const canRollRef = useRef(canRoll)
  const seenTurnAdvanceRef = useRef<string>('')
  const currentTurnPlayerIdRef = useRef(gameState.turn.currentPlayerId)
  const localPlayerIdRef = useRef(localPlayerId ?? '')
  const hudCursorRef = useRef({ version: -1, eventCount: 0 })
  const hudSkipHistoryRef = useRef(true)
  const [isSequencingRoll, setIsSequencingRoll] = useState(false)
  const [showYourTurnBanner, setShowYourTurnBanner] = useState(false)
  const [bannerText, setBannerText] = useState('✦ ĐẾN LƯỢT CỦA BẠN ✦')
  const [showRollButton, setShowRollButton] = useState(canRoll)
  const [displayedTurnPlayerId, setDisplayedTurnPlayerId] = useState(gameState.turn.currentPlayerId)
  const [displayedFinishOrderIds, setDisplayedFinishOrderIds] = useState<string[]>([])

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

  const finishOrderIds = useMemo(() => finishOrder.map((player) => player.id), [finishOrder])

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

  const currentTurnPlayer = gameState.players.find((p) => p.id === gameState.turn.currentPlayerId) ?? null
  const displayedTurnPlayer =
    gameState.players.find((p) => p.id === displayedTurnPlayerId) ?? currentTurnPlayer
  const displayedFinishOrder = displayedFinishOrderIds
    .map((id) => gameState.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const localPlayer: Player | null = localPlayerId
    ? gameState.players.find((p) => p.id === localPlayerId) ?? null
    : gameState.players[0] ?? displayedTurnPlayer
  const isMyTurn = localPlayer
    ? gameState.turn.currentPlayerId === localPlayer.id
    : isLocalPlayersTurn

  useEffect(() => {
    currentTurnPlayerIdRef.current = gameState.turn.currentPlayerId
    localPlayerIdRef.current = localPlayer?.id ?? ''
  }, [gameState.turn.currentPlayerId, localPlayer])

  useEffect(() => {
    if (hudSkipHistoryRef.current) {
      hudSkipHistoryRef.current = false
      hudCursorRef.current = { version: gameState.version, eventCount: gameState.events.length }
      setDisplayedTurnPlayerId(gameState.turn.currentPlayerId)
      setDisplayedFinishOrderIds(finishOrderIds)
      return
    }

    const hasVersionAdvanced = gameState.version !== hudCursorRef.current.version
    const deltaEvents = hasVersionAdvanced
      ? gameState.events.slice(hudCursorRef.current.eventCount)
      : []

    hudCursorRef.current = { version: gameState.version, eventCount: gameState.events.length }

    const hasMotionAnimation = deltaEvents.some(
      (event) => event.type === 'token_moved' || event.type === 'token_captured',
    )

    if (isPresentingDice) {
      return
    }

    if (!hasMotionAnimation) {
      if (hudCommitTimerRef.current) {
        window.clearTimeout(hudCommitTimerRef.current)
        hudCommitTimerRef.current = null
      }
      setDisplayedTurnPlayerId(gameState.turn.currentPlayerId)
      setDisplayedFinishOrderIds(finishOrderIds)
      return
    }

    const latestMoveEvent = [...deltaEvents]
      .reverse()
      .find((event) => event.type === 'token_moved')
    const pathLength = Array.isArray(latestMoveEvent?.details?.path)
      ? latestMoveEvent.details.path.length
      : 0
    const hasCapture = deltaEvents.some((event) => event.type === 'token_captured')
    const movementDelayMs = Math.max(Math.max(1, pathLength) * 300, hasCapture ? 800 : 0) + 150

    if (hudCommitTimerRef.current) {
      window.clearTimeout(hudCommitTimerRef.current)
      hudCommitTimerRef.current = null
    }

    const nextTurnPlayerId = gameState.turn.currentPlayerId
    const nextFinishOrderIds = [...finishOrderIds]
    hudCommitTimerRef.current = window.setTimeout(() => {
      setDisplayedTurnPlayerId(nextTurnPlayerId)
      setDisplayedFinishOrderIds(nextFinishOrderIds)
      hudCommitTimerRef.current = null
    }, movementDelayMs)
  }, [finishOrderIds, gameState.events, gameState.turn.currentPlayerId, gameState.version, isPresentingDice])

  const showBannerOnce = (text: string) => {
    if (bannerHideTimerRef.current) {
      window.clearTimeout(bannerHideTimerRef.current)
      bannerHideTimerRef.current = null
    }
    setBannerText(text)
    setShowYourTurnBanner(true)
    bannerHideTimerRef.current = window.setTimeout(() => {
      setShowYourTurnBanner(false)
      bannerHideTimerRef.current = null
    }, 1000)
  }

  const showTurnBannerAndRollSync = (text: string) => {
    showBannerOnce(text)
    if (canRollRef.current) {
      setShowRollButton(true)
    }
  }

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

  useEffect(() => {
    canRollRef.current = canRoll
    if (!canRoll) {
      setShowRollButton(false)
      return
    }
    if (!isSequencingRoll) {
      setShowRollButton(true)
    }
  }, [canRoll, isSequencingRoll])

  useEffect(() => {
    const presentationJustFinished = wasPresentingRef.current && !isPresentingDice
    wasPresentingRef.current = isPresentingDice
    if (!presentationJustFinished) return

    if (bannerHideTimerRef.current) {
      window.clearTimeout(bannerHideTimerRef.current)
      bannerHideTimerRef.current = null
    }
    if (rollShowTimerRef.current) {
      window.clearTimeout(rollShowTimerRef.current)
      rollShowTimerRef.current = null
    }

    const shouldShowBanner = isMyTurn && gameState.status === 'playing'
    if (shouldShowBanner) {
      const isChoosingMove =
        gameState.turn.phase === 'waiting_choice' && gameState.turn.legalMoves.length > 1
      showTurnBannerAndRollSync(isChoosingMove ? '✦ HÃY CHỌN NƯỚC ĐI ✦' : '✦ ĐẾN LƯỢT CỦA BẠN ✦')
    }

    if (isSequencingRoll) {
      const revealDelay = 1000
      rollShowTimerRef.current = window.setTimeout(() => {
        if (canRollRef.current) {
          setShowRollButton(true)
        }
        setIsSequencingRoll(false)
        rollShowTimerRef.current = null
      }, revealDelay)
    }
  }, [
    gameState.status,
    gameState.turn.legalMoves.length,
    gameState.turn.phase,
    isMyTurn,
    isPresentingDice,
    isSequencingRoll,
  ])

  useEffect(() => {
    if (!localPlayer || gameState.status !== 'playing') return

    const latestTurnAdvanced = [...gameState.events]
      .reverse()
      .find((event) => event.type === 'turn_advanced')
    if (!latestTurnAdvanced) return

    const marker = `${latestTurnAdvanced.timestamp}:${gameState.version}`
    if (marker === seenTurnAdvanceRef.current) return
    seenTurnAdvanceRef.current = marker

    const nextPlayerId =
      typeof latestTurnAdvanced.details?.nextPlayerId === 'string'
        ? latestTurnAdvanced.details.nextPlayerId
        : null
    if (nextPlayerId !== localPlayer.id) return
    if (isPresentingDice) return

    const latestMoveEvent = [...gameState.events]
      .reverse()
      .find((event) => event.type === 'token_moved')
    const pathLength = Array.isArray(latestMoveEvent?.details?.path)
      ? latestMoveEvent.details.path.length
      : 0
    const movementDelayMs = Math.max(1, pathLength) * 300 + 150

    if (moveBannerTimerRef.current) {
      window.clearTimeout(moveBannerTimerRef.current)
      moveBannerTimerRef.current = null
    }
    moveBannerTimerRef.current = window.setTimeout(() => {
      if (currentTurnPlayerIdRef.current !== localPlayerIdRef.current) return
      showTurnBannerAndRollSync('✦ ĐẾN LƯỢT CỦA BẠN ✦')
      moveBannerTimerRef.current = null
    }, movementDelayMs)
  }, [gameState.events, gameState.status, gameState.turn.currentPlayerId, gameState.version, isPresentingDice, localPlayer])

  useEffect(
    () => () => {
      if (bannerHideTimerRef.current) window.clearTimeout(bannerHideTimerRef.current)
      if (rollShowTimerRef.current) window.clearTimeout(rollShowTimerRef.current)
      if (moveBannerTimerRef.current) window.clearTimeout(moveBannerTimerRef.current)
      if (hudCommitTimerRef.current) window.clearTimeout(hudCommitTimerRef.current)
    },
    [],
  )

  const handleSelectToken = (tokenId: string) => {
    if (isPresentingDice || !isWaitingChoice) return
    const moveId = moveIdByTokenId.get(tokenId)
    if (moveId) onSelectMove(moveId)
  }

  const handleRollClick = () => {
    setShowRollButton(false)
    setIsSequencingRoll(true)
    onRoll()
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

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute left-4 top-4">
          <Link
            to={backHref}
            className="rounded-xl bg-white/70 px-3 py-1 text-sm font-semibold text-gray-700 shadow backdrop-blur-sm transition-all hover:bg-white/90"
          >
            {gameState.status === 'finished' ? 'Ve lobby' : 'Back'}
          </Link>
        </div>
        <CurrentTurnPanel player={displayedTurnPlayer} isLocalTurn={isMyTurn} />
        <MyPlayerPanel player={localPlayer} />
        <FinishOrderPanel players={displayedFinishOrder} />
        <YourTurnBanner
          visible={showYourTurnBanner}
          color={localPlayer?.color ?? 'red'}
          text={bannerText}
        />
        <RollDiceButton
          visible={showRollButton && canRoll && gameState.status !== 'finished'}
          color={localPlayer?.color ?? 'red'}
          onClick={handleRollClick}
        />
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
