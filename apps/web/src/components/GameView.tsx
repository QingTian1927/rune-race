import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProgress } from '@react-three/drei'
import type { Player, GameState, RuneClientView } from '@rune-race/shared'
import { listValidPlacementCellIds } from '@rune-race/game-engine'
import { placementRejectMessage } from '../lib/runeMarkerDisplay'
import { HandArrayPanel } from './hud/HandArrayPanel'
import { RuneCardPreviewOverlay } from './hud/RuneCardPreviewOverlay'
import { useBoardImpactFeedback } from '../hooks/useBoardImpactFeedback'
import BoardScene from '../scenes/BoardScene'
import type { CameraDebugInfo } from '../config/cameraConfig'
import CameraDevMenu from './dev/CameraDevMenu'
import { BoardLayoutData, createInitialEditorState, EditorMode } from '../utils/boardEditorState'
import { BoardEditorControls } from '../components/BoardEditor'
import type { BoardImpactFeedback } from '../lib/boardImpact'
import { CurrentTurnPanel } from './hud/CurrentTurnPanel'
import { MyPlayerPanel } from './hud/MyPlayerPanel'
import { FinishOrderPanel } from './hud/FinishOrderPanel'
import { GameEndOverlay } from './hud/GameEndOverlay'
import { YourTurnBanner } from './hud/YourTurnBanner'
import { RollDiceButton } from './hud/RollDiceButton'
import { usePlayerAvatars } from '../hooks/usePlayerAvatars'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { GameSettingsOverlay } from './hud/GameSettingsOverlay'
import { LandscapeHintOverlay } from './hud/LandscapeHintOverlay'
import { useGraphicsQuality } from '../hooks/useGraphicsQuality'
import { useLandscapeHint } from '../hooks/useLandscapeHint'
import { useFullscreen } from '../hooks/useFullscreen'

function LoadingOverlay({ active, progress }: { active: boolean; progress: number }) {
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="game-hud-backdrop" aria-hidden />
      <div className="game-hud-loading-card">
        <div className="game-hud-loading-spinner" aria-hidden />
        <p className="game-hud-loading-text">Đang tải bàn cờ… {Math.round(progress)}%</p>
      </div>
    </div>
  )
}

export type GameViewProps = {
  gameState: GameState
  rollTrigger: number
  onRoll: () => void
  onSelectMove: (moveId: string) => void
  /** Navigate here when leaving or auto-returning if `onLeave` is not set (local mock). */
  backHref?: string
  canRoll?: boolean
  /** Local mock: auto-resolve after dice animation */
  autoResolveRolled?: boolean
  isPresentingDice?: boolean
  /** When set, move-selection arrows only show for this player (online). */
  localPlayerId?: string
  localAvatarEmoji?: string | null
  /** Online: leave game + lobby after user confirms exit. */
  onLeave?: () => void
  /** Board land/spawn SFX + reduced motion (optional override). */
  boardImpactFeedback?: BoardImpactFeedback
  /** Optional lobby chat overlay (online). */
  roomChat?: ReactNode
  runeView?: RuneClientView | null
  onDrawCards?: (count: number) => void
  onFinishDraw?: () => void
  onPlaceMarker?: (heldCardId: string, cellId: number, displayedIdentityId: string) => void
  onChooseSwap?: (targetTokenId: string) => void
  /** Socket / server action errors (online). */
  gameActionError?: string | null
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
  localAvatarEmoji,
  onLeave,
  boardImpactFeedback: boardImpactFeedbackProp,
  roomChat,
  runeView = null,
  onDrawCards,
  onFinishDraw,
  onPlaceMarker,
  onChooseSwap,
  gameActionError = null,
}: GameViewProps) {
  const navigate = useNavigate()
  const { active, progress } = useProgress()
  const landscapeHint = useLandscapeHint()
  const fullscreen = useFullscreen()
  const defaultBoardImpactFeedback = useBoardImpactFeedback()
  const boardImpactFeedback = boardImpactFeedbackProp ?? defaultBoardImpactFeedback
  const { quality: graphicsQuality, setQuality: setGraphicsQuality } = useGraphicsQuality()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const [showDevMenu, setShowDevMenu] = useState(false)
  const [cameraDebugInfo, setCameraDebugInfo] = useState<CameraDebugInfo | null>(null)
  const [isEditorActive, setIsEditorActive] = useState(false)
  const [editorData, setEditorData] = useState<BoardLayoutData>(createInitialEditorState().data)
  const [editorMode, setEditorMode] = useState<EditorMode>('main-track')
  const [editorSelectedPlayer, setEditorSelectedPlayer] = useState(0)
  const [editorMouseMode, setEditorMouseMode] = useState<'draw' | 'camera'>('draw')
  const resolveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const bannerHideTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const rollShowTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const moveBannerTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const hudCommitTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const endCountdownTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(null)
  const endCountdownTriggeredRef = useRef(false)
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
  const [endCountdownSeconds, setEndCountdownSeconds] = useState(10)
  const [selectedHeldCardId, setSelectedHeldCardId] = useState<string | null>(null)
  const [cardPreviewId, setCardPreviewId] = useState<string | null>(null)
  const [placementConfirmCellId, setPlacementConfirmCellId] = useState<number | null>(null)
  const [placementCellId, setPlacementCellId] = useState<number | null>(null)
  const [hoveredPlacementCellId, setHoveredPlacementCellId] = useState<number | null>(null)
  const [placementNotice, setPlacementNotice] = useState<string | null>(null)
  const pendingPlacementRef = useRef<{ heldCardId: string; cellId: number } | null>(null)
  const placementEventsCursorRef = useRef({ version: -1, eventCount: 0 })

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

  const isLocalPlayersTurn =
    localPlayerId === undefined || gameState.turn.currentPlayerId === localPlayerId

  const currentTurnPlayer = gameState.players.find((p) => p.id === gameState.turn.currentPlayerId) ?? null
  const localPlayer: Player | null = localPlayerId
    ? gameState.players.find((p) => p.id === localPlayerId) ?? null
    : gameState.players[0] ?? currentTurnPlayer
  const isMyTurn = localPlayer
    ? gameState.turn.currentPlayerId === localPlayer.id
    : isLocalPlayersTurn

  const runesOn = Boolean(gameState.config?.runesEnabled && gameState.rune)
  const myRune = localPlayerId ? gameState.rune?.players[localPlayerId] : null
  const runeWindowOpen =
    runesOn &&
    (gameState.turn.phase === 'placement_phase' || gameState.turn.phase === 'waiting_draw')
  const placementPhaseActive = runeWindowOpen
  const myHandCount = myRune?.hand.length ?? 0
  /** Spec §3.1 step 3: any player holding cards may place during simultaneous placement. */
  const canPlaceRunes =
    placementPhaseActive && myHandCount > 0 && Boolean(onPlaceMarker)
  const canDrawDuringTurn =
    isMyTurn && runeWindowOpen && Boolean(onDrawCards)

  const isWaitingChoice =
    isLocalPlayersTurn &&
    !isPresentingDice &&
    gameState.status === 'playing' &&
    gameState.turn.phase === 'waiting_choice' &&
    gameState.turn.legalMoves.length > 1

  const isSwapChoicePhase =
    gameState.turn.phase === 'waiting_swap_choice' && Boolean(gameState.turn.pendingSwap)

  const canChooseSwapTarget =
    isSwapChoicePhase &&
    isMyTurn &&
    !isPresentingDice &&
    Boolean(onChooseSwap)

  const isWaitingSwap = canChooseSwapTarget

  const swapChoiceTargetIds = useMemo(() => {
    if (!isSwapChoicePhase || !gameState.turn.pendingSwap) return []
    const displayedId = gameState.turn.pendingSwap.displayedIdentityId
    const activatorId = gameState.turn.pendingSwap.activatorTokenId
    return gameState.tokens
      .filter(
        (t) =>
          t.playerId === displayedId &&
          t.state === 'on_track' &&
          t.id !== activatorId,
      )
      .map((t) => t.id)
  }, [gameState.tokens, gameState.turn.pendingSwap, isSwapChoicePhase])

  const swapPreviewTokenIds = useMemo(() => {
    if (!isSwapChoicePhase || !gameState.turn.pendingSwap) return []
    return [gameState.turn.pendingSwap.activatorTokenId, ...swapChoiceTargetIds]
  }, [gameState.turn.pendingSwap, isSwapChoicePhase, swapChoiceTargetIds])

  const selectableTokenIds = useMemo(() => {
    if (isWaitingSwap) {
      return swapChoiceTargetIds
    }
    if (!isWaitingChoice) return []
    const seen = new Set<string>()
    gameState.turn.legalMoves.forEach((m) => seen.add(m.tokenId))
    return Array.from(seen)
  }, [gameState.turn.legalMoves, isWaitingChoice, isWaitingSwap, swapChoiceTargetIds])

  const tokenSelectionMode = isSwapChoicePhase ? 'swap' : 'move'
  const swapActivatorTokenId = gameState.turn.pendingSwap?.activatorTokenId ?? null

  const moveIdByTokenId = useMemo(() => {
    const map = new Map<string, string>()
    gameState.turn.legalMoves.forEach((move) => {
      if (!map.has(move.tokenId)) map.set(move.tokenId, move.id)
    })
    return map
  }, [gameState.turn.legalMoves])

  const displayedTurnPlayer =
    gameState.players.find((p) => p.id === displayedTurnPlayerId) ?? currentTurnPlayer
  const displayedFinishOrder = displayedFinishOrderIds
    .map((id) => gameState.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const finishOrderReady = useMemo(
    () => finishOrderIds.every((id) => displayedFinishOrderIds.includes(id)),
    [displayedFinishOrderIds, finishOrderIds],
  )

  const endOverlayEntries = useMemo(() => {
    const finishedIds = new Set(displayedFinishOrderIds)
    const remainingPlayers = gameState.players.filter((player) => !finishedIds.has(player.id))
    const orderedPlayers = [...displayedFinishOrder, ...remainingPlayers]
    return orderedPlayers.map((player, index) => ({
      player,
      rank: index + 1,
      isUnfinished: !finishedIds.has(player.id),
    }))
  }, [displayedFinishOrder, displayedFinishOrderIds, gameState.players])

  const playerIds = useMemo(() => gameState.players.map((p) => p.id), [gameState.players])
  const fetchedAvatars = usePlayerAvatars(
    playerIds,
    localPlayerId && localAvatarEmoji
      ? { playerId: localPlayerId, emoji: localAvatarEmoji }
      : undefined,
  )
  const avatarsByPlayerId = fetchedAvatars

  const avatarFor = (playerId: string | undefined) =>
    playerId ? (avatarsByPlayerId[playerId] ?? null) : null

  const returnDestinationLabel = backHref.startsWith('/lobby/') ? 'lobby' : 'trang chủ'
  const showEndOverlay =
    gameState.status === 'finished' && !isPresentingDice && finishOrderReady

  const clearEndCountdown = useCallback(() => {
    if (endCountdownTimerRef.current) {
      window.clearInterval(endCountdownTimerRef.current)
      endCountdownTimerRef.current = null
    }
  }, [])

  const handleReturnToLobby = useCallback(() => {
    clearEndCountdown()
    navigate(backHref)
  }, [backHref, clearEndCountdown, navigate])

  const handleLeaveNow = useCallback(() => {
    clearEndCountdown()
    if (onLeave) {
      onLeave()
    } else {
      navigate(backHref)
    }
  }, [backHref, clearEndCountdown, navigate, onLeave])

  useEffect(() => {
    if (!showEndOverlay) {
      clearEndCountdown()
      endCountdownTriggeredRef.current = false
      setEndCountdownSeconds(10)
      return
    }

    if (endCountdownTimerRef.current) return

    endCountdownTriggeredRef.current = false
    setEndCountdownSeconds(10)
    endCountdownTimerRef.current = window.setInterval(() => {
      setEndCountdownSeconds((current) => {
        if (current <= 1) {
          if (!endCountdownTriggeredRef.current) {
            endCountdownTriggeredRef.current = true
            handleReturnToLobby()
          }
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => {
      clearEndCountdown()
    }
  }, [clearEndCountdown, handleReturnToLobby, showEndOverlay])

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

  const showBannerOnce = (text: string, durationMs = 1000) => {
    if (bannerHideTimerRef.current) {
      window.clearTimeout(bannerHideTimerRef.current)
      bannerHideTimerRef.current = null
    }
    setBannerText(text)
    setShowYourTurnBanner(true)
    bannerHideTimerRef.current = window.setTimeout(() => {
      setShowYourTurnBanner(false)
      bannerHideTimerRef.current = null
    }, durationMs)
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
      if (e.key === 'F4') {
        e.preventDefault()
        setIsEditorActive((c) => !c)
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
      if (endCountdownTimerRef.current) window.clearInterval(endCountdownTimerRef.current)
    },
    [],
  )

  const handleSelectToken = (tokenId: string) => {
    if (isPresentingDice) return
    if (isWaitingSwap) {
      onChooseSwap?.(tokenId)
      return
    }
    if (!isWaitingChoice) return
    const moveId = moveIdByTokenId.get(tokenId)
    if (moveId) onSelectMove(moveId)
  }

  const validPlacementCells = useMemo(() => {
    if (!runesOn || !canPlaceRunes) return []
    return listValidPlacementCellIds(gameState)
  }, [canPlaceRunes, gameState, runesOn])

  const selectedPlacementCard = useMemo(() => {
    if (!myRune || !selectedHeldCardId) return null
    return myRune.hand.find((card) => card.heldCardId === selectedHeldCardId) ?? null
  }, [myRune, selectedHeldCardId])

  const runePlacementActive = Boolean(
    selectedHeldCardId && canPlaceRunes && !isEditorActive,
  )

  const resetPlacementUi = useCallback(() => {
    setPlacementCellId(null)
    setPlacementConfirmCellId(null)
    setHoveredPlacementCellId(null)
  }, [])

  const clearPlacementSelection = useCallback(() => {
    setSelectedHeldCardId(null)
    setCardPreviewId(null)
    resetPlacementUi()
  }, [resetPlacementUi])

  const handleCardSelect = useCallback(
    (heldCardId: string) => {
      if (!canPlaceRunes) {
        if (!placementPhaseActive) {
          setPlacementNotice('Chỉ đặt rune trong pha đặt thẻ.')
        } else if (myHandCount <= 0) {
          setPlacementNotice('Bạn không còn thẻ trong tay.')
        }
        return
      }
      if (selectedHeldCardId === heldCardId && cardPreviewId === null && placementConfirmCellId === null) {
        clearPlacementSelection()
        setPlacementNotice(null)
        return
      }
      setSelectedHeldCardId(heldCardId)
      setCardPreviewId(null)
      setPlacementConfirmCellId(null)
      setPlacementCellId(null)
      setHoveredPlacementCellId(null)
      setPlacementNotice(null)
    },
    [
      canPlaceRunes,
      cardPreviewId,
      clearPlacementSelection,
      myHandCount,
      placementConfirmCellId,
      placementPhaseActive,
      selectedHeldCardId,
    ],
  )

  const handleCardPreview = useCallback(
    (heldCardId: string) => {
      if (!canPlaceRunes) return
      setSelectedHeldCardId(null)
      setCardPreviewId(heldCardId)
      setPlacementConfirmCellId(null)
      setPlacementCellId(null)
      setHoveredPlacementCellId(null)
    },
    [canPlaceRunes],
  )

  const handlePreviewPickLocation = useCallback(() => {
    if (!cardPreviewId) return
    setSelectedHeldCardId(cardPreviewId)
    setCardPreviewId(null)
  }, [cardPreviewId])

  const handlePreviewCancel = useCallback(() => {
    if (placementConfirmCellId !== null) {
      setPlacementConfirmCellId(null)
      setPlacementCellId(null)
      setHoveredPlacementCellId(null)
      return
    }
    setCardPreviewId(null)
  }, [placementConfirmCellId])

  const handlePlacementCell = (cellId: number) => {
    if (!selectedHeldCardId) return
    setPlacementCellId(cellId)
    setPlacementConfirmCellId(cellId)
  }

  const commitPlacement = (displayedIdentityId: string) => {
    if (!selectedHeldCardId || placementConfirmCellId === null) return
    pendingPlacementRef.current = {
      heldCardId: selectedHeldCardId,
      cellId: placementConfirmCellId,
    }
    onPlaceMarker?.(selectedHeldCardId, placementConfirmCellId, displayedIdentityId)
    setPlacementConfirmCellId(null)
    setPlacementCellId(null)
    setHoveredPlacementCellId(null)
    setPlacementNotice(null)
  }

  const previewOverlayCard = useMemo(() => {
    if (!myRune) return null
    const previewId = cardPreviewId ?? (placementConfirmCellId !== null ? selectedHeldCardId : null)
    if (!previewId) return null
    return myRune.hand.find((card) => card.heldCardId === previewId) ?? null
  }, [cardPreviewId, myRune, placementConfirmCellId, selectedHeldCardId])

  const previewOverlayOpen = cardPreviewId !== null || placementConfirmCellId !== null
  const previewOverlayMode = placementConfirmCellId !== null ? 'confirm' : 'preview'
  const hideRollDuringRunePlacement = previewOverlayOpen || runePlacementActive

  useEffect(() => {
    if (!placementPhaseActive) {
      clearPlacementSelection()
      pendingPlacementRef.current = null
      setPlacementNotice(null)
    }
  }, [clearPlacementSelection, placementPhaseActive])

  useEffect(() => {
    if (!localPlayerId) return

    const deltaEvents =
      gameState.version !== placementEventsCursorRef.current.version
        ? gameState.events.slice(placementEventsCursorRef.current.eventCount)
        : []
    placementEventsCursorRef.current = {
      version: gameState.version,
      eventCount: gameState.events.length,
    }

    const pending = pendingPlacementRef.current
    for (const event of deltaEvents) {
      if (event.playerId !== localPlayerId) continue

      if (event.type === 'marker_placed') {
        const cellId = event.details?.cellId
        if (pending && cellId === pending.cellId) {
          pendingPlacementRef.current = null
          clearPlacementSelection()
          setPlacementNotice(null)
          continue
        }
      }

      if (event.type === 'marker_place_rejected') {
        const reason = placementRejectMessage(event.details?.reason)
        pendingPlacementRef.current = null
        if (pending) {
          setSelectedHeldCardId(pending.heldCardId)
        }
        setPlacementNotice(reason)
      }
    }
  }, [clearPlacementSelection, gameState.events, gameState.version, localPlayerId])

  useEffect(() => {
    if (!gameActionError) return
    if (/place|marker|rune|cell|thẻ/i.test(gameActionError)) {
      setPlacementNotice(gameActionError)
      pendingPlacementRef.current = null
    }
  }, [gameActionError])

  useEffect(() => {
    if (!runePlacementActive) return
    if (validPlacementCells.length === 0) {
      setPlacementNotice('Không còn ô trống để đặt rune.')
      return
    }
    setPlacementNotice((prev) =>
      prev === 'Không còn ô trống để đặt rune.' ? null : prev,
    )
  }, [runePlacementActive, validPlacementCells.length])

  const handleRollClick = () => {
    setShowRollButton(false)
    setIsSequencingRoll(true)
    onRoll()
  }

  const closeExitConfirm = useCallback(() => setExitConfirmOpen(false), [])

  const handleExitClick = () => setExitConfirmOpen(true)

  const handleExitConfirm = () => {
    setExitConfirmOpen(false)
    clearEndCountdown()
    if (onLeave) {
      onLeave()
    } else {
      navigate(backHref)
    }
  }

  const finished = gameState.status === 'finished'
  const exitConfirmTitle = onLeave ? 'Rời game?' : 'Thoát game?'
  const exitConfirmMessage = onLeave
    ? finished
      ? 'Bạn sẽ rời game và quay về trang chủ.'
      : 'Bạn sẽ bỏ cuộc, rời phòng và quay về trang chủ. Đối thủ có thể thắng nếu bạn thoát giữa chừng.'
    : finished
      ? 'Quay về trang chủ?'
      : 'Rời game thử nghiệm và quay về trang chủ.'
  const exitConfirmLabel = onLeave ? 'Rời game' : 'Thoát'

  return (
    <div className="game-hud-shell relative h-screen w-full overflow-hidden">
      <BoardScene
        onDebugInfoChange={showDevMenu ? setCameraDebugInfo : undefined}
        isEditorActive={isEditorActive}
        gameState={gameState}
        runeView={runeView}
        localPlayerId={localPlayerId}
        rollTrigger={rollTrigger}
        selectableTokenIds={selectableTokenIds}
        tokenSelectionMode={tokenSelectionMode}
        swapActivatorTokenId={swapActivatorTokenId}
        swapPreviewTokenIds={swapPreviewTokenIds}
        swapChoiceTargetIds={swapChoiceTargetIds}
        swapSelectionEnabled={canChooseSwapTarget}
        onSelectToken={handleSelectToken}
        freezeTokenAnimations={isPresentingDice}
        boardImpactFeedback={boardImpactFeedback}
        graphicsQuality={graphicsQuality}
        editorData={editorData}
        editorMode={editorMode}
        editorSelectedPlayer={editorSelectedPlayer}
        onEditorDataChange={setEditorData}
        editorMouseMode={editorMouseMode}
        setEditorMouseMode={setEditorMouseMode}
        runePlacementActive={runePlacementActive}
        validPlacementCellIds={validPlacementCells}
        hoveredPlacementCellId={hoveredPlacementCellId}
        selectedPlacementCellId={placementCellId}
        selectedPlacementCardType={selectedPlacementCard?.cardType ?? null}
        placementPreviewPlayer={localPlayer}
        placementPreviewAvatar={avatarFor(localPlayer?.id)}
        onHoverPlacementCell={setHoveredPlacementCellId}
        onSelectPlacementCell={handlePlacementCell}
      />

      <div className="game-hud-overlay">
        {!showEndOverlay ? (
          <>
            <div className="game-hud-slot game-hud-slot--exit">
              <div className="game-hud-exit-row">
                <button type="button" onClick={handleExitClick} className="game-hud-exit-btn">
                  {onLeave ? 'Rời game' : 'Thoát'}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="game-hud-settings-btn"
                  aria-label="Cài đặt"
                >
                  <i className="bi bi-gear-fill" aria-hidden="true" />
                </button>
                {fullscreen.supported ? (
                  <button
                    type="button"
                    onClick={() => void fullscreen.toggle()}
                    className="game-hud-settings-btn"
                    aria-label={fullscreen.active ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                    aria-pressed={fullscreen.active}
                  >
                    <i
                      className={
                        fullscreen.active ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen'
                      }
                      aria-hidden="true"
                    />
                  </button>
                ) : null}
              </div>
            </div>
            <CurrentTurnPanel
              player={displayedTurnPlayer}
              isLocalTurn={isMyTurn}
              avatarEmoji={avatarFor(displayedTurnPlayer?.id)}
            />
            <MyPlayerPanel player={localPlayer} avatarEmoji={avatarFor(localPlayer?.id)} />
            <FinishOrderPanel
              players={displayedFinishOrder}
              avatarsByPlayerId={avatarsByPlayerId}
            />
            <YourTurnBanner
              visible={showYourTurnBanner}
              color={localPlayer?.color ?? 'red'}
              text={bannerText}
            />
            <div className="game-hud-slot game-hud-slot--roll">
              <RollDiceButton
                visible={
                  showRollButton &&
                  canRoll &&
                  gameState.status !== 'finished' &&
                  !hideRollDuringRunePlacement
                }
                color={localPlayer?.color ?? 'red'}
                onClick={handleRollClick}
              />
            </div>
            {runesOn && myRune ? (
              <HandArrayPanel
                hand={myRune.hand}
                pendingRewardCount={myRune.pendingRewards.length}
                drawCount={myRune.drawCount}
                selectedCardId={selectedHeldCardId}
                onCardSelect={handleCardSelect}
                onCardPreview={handleCardPreview}
                canSelectCards={canPlaceRunes}
                canDraw={canDrawDuringTurn && myRune.hand.length < 10 && myRune.drawCount < 25}
                onDraw={() => onDrawCards?.(1)}
                runeActionActive={Boolean((isMyTurn && runeWindowOpen) || canPlaceRunes)}
                playerColor={localPlayer?.color ?? 'blue'}
                drawDisabledTitle={
                  isMyTurn && runeWindowOpen
                    ? myRune.hand.length >= 10
                      ? 'Tay đầy'
                      : myRune.drawCount >= 25
                        ? 'Hết lượt bốc'
                        : undefined
                    : undefined
                }
              />
            ) : null}
            {roomChat}
            {placementNotice ? (
              <div className="game-hud-slot game-hud-slot--placement-hint">
                <p className="rune-placement-hint rune-placement-hint--error" role="status" aria-live="polite">
                  {placementNotice}
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <RuneCardPreviewOverlay
        open={previewOverlayOpen && Boolean(previewOverlayCard) && canPlaceRunes}
        mode={previewOverlayMode}
        card={previewOverlayCard}
        localPlayer={localPlayer ?? gameState.players[0]!}
        players={gameState.players}
        avatarsByPlayerId={avatarsByPlayerId}
        onCancel={handlePreviewCancel}
        onPickLocation={handlePreviewPickLocation}
        onPickIdentity={commitPlacement}
      />

      {showDevMenu ? (
        <div className="pointer-events-none absolute right-4 top-4 z-30">
          <CameraDevMenu info={cameraDebugInfo} onClose={() => setShowDevMenu(false)} />
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

      <GameEndOverlay
        open={showEndOverlay}
        entries={endOverlayEntries}
        countdownSeconds={endCountdownSeconds}
        returnDestinationLabel={returnDestinationLabel}
        avatarsByPlayerId={avatarsByPlayerId}
        onLeave={handleLeaveNow}
      />

      <GameSettingsOverlay
        open={settingsOpen}
        quality={graphicsQuality}
        onQualityChange={setGraphicsQuality}
        onClose={() => setSettingsOpen(false)}
      />

      <ConfirmDialog
        open={exitConfirmOpen}
        title={exitConfirmTitle}
        message={exitConfirmMessage}
        confirmLabel={exitConfirmLabel}
        cancelLabel="Ở lại"
        destructive={Boolean(onLeave)}
        onConfirm={handleExitConfirm}
        onCancel={closeExitConfirm}
      />

      <LandscapeHintOverlay
        open={landscapeHint.visible && !active}
        onDismiss={landscapeHint.dismissForNow}
        onDismissForever={landscapeHint.dismissForever}
      />
    </div>
  )
}
