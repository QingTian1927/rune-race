import { useMemo, useRef } from 'react'
import type { RuneClientView } from '@rune-race/shared'
import {
  handleChooseMove,
  handleChooseSwap,
  handleDrawCards as engineDrawCards,
  handleConfirmDraw as engineConfirmDraw,
  handleFinishDraw as engineFinishDraw,
  handleConfirmPlacementReady as engineConfirmPlacementReady,
  handlePlaceMarker as enginePlaceMarker,
  handleRoll as engineHandleRoll,
  handleUseLeaveStable,
} from '@rune-race/game-engine'
import GameView from '../components/GameView'
import getMockSnapshot from '../mock/getMockSnapshot'
import { usePresentationGameState } from '../hooks/usePresentationGameState'

function buildLocalRuneView(
  state: ReturnType<typeof getMockSnapshot>,
  viewerId: string,
): RuneClientView | null {
  if (!state.rune) return null
  return {
    myMarkers: state.rune.markers
      .filter((m) => m.realPlacerId === viewerId)
      .map((m) => ({ markerId: m.markerId, cardType: m.cardType })),
    myPendingDraw: state.rune.players[viewerId]?.pendingDraw ?? null,
  }
}

export default function LocalGamePage() {
  const localPlayerId = 'player-red'
  const initial = useRef(getMockSnapshot()).current
  const { displayState, isPresentingDice, rollTrigger, applyAuthoritativeState } =
    usePresentationGameState(initial)

  const runeView = useMemo(
    () => (displayState ? buildLocalRuneView(displayState, localPlayerId) : null),
    [displayState],
  )

  if (!displayState) {
    return null
  }

  const apply = (next: typeof displayState) => {
    if (!next) return
    const delta = next.events.slice(displayState.events.length)
    applyAuthoritativeState(next, { deltaEvents: delta })
  }

  const activePlayerId = displayState.turn.currentPlayerId

  const onRollClick = () => {
    if (isPresentingDice) return
    const result = engineHandleRoll(displayState, activePlayerId)
    if (result.success) apply(result.state)
  }

  const handleSelectMove = (moveId: string) => {
    if (isPresentingDice) return
    const result = handleChooseMove(displayState, activePlayerId, moveId)
    if (result.success) apply(result.state)
  }

  const handleDrawCards = (count: number) => {
    const result = engineDrawCards(displayState, localPlayerId, count)
    if (result.success) apply(result.state)
  }

  const handleConfirmDraw = () => {
    const result = engineConfirmDraw(displayState, localPlayerId)
    if (result.success) apply(result.state)
  }

  const handleFinishDraw = () => {
    const result = engineFinishDraw(displayState, localPlayerId)
    if (result.success) apply(result.state)
  }

  const handlePlaceMarker = (
    heldCardId: string,
    cellId: number,
    displayedIdentityId: string,
  ) => {
    const result = enginePlaceMarker(
      displayState,
      localPlayerId,
      heldCardId,
      cellId,
      displayedIdentityId,
    )
    if (result.success) apply(result.state)
  }

  const handleChooseSwapTarget = (targetTokenId: string) => {
    const result = handleChooseSwap(displayState, activePlayerId, targetTokenId)
    if (result.success) apply(result.state)
  }

  const handleUseLeaveStableCard = (heldCardId: string) => {
    const result = handleUseLeaveStable(displayState, localPlayerId, heldCardId)
    if (result.success) apply(result.state)
  }

  const canRoll = useMemo(() => {
    if (isPresentingDice || displayState.status !== 'playing') return false
    if (displayState.turn.currentPlayerId !== activePlayerId) return false
    const phase = displayState.turn.phase
    if (phase === 'waiting_roll') return true
    if (phase === 'leave_stable_phase') return true
    return false
  }, [displayState, isPresentingDice, activePlayerId])

  const onConfirmPlacementReady = () => {
    const result = engineConfirmPlacementReady(displayState, localPlayerId)
    if (result.success) apply(result.state)
  }

  return (
    <GameView
      gameState={displayState}
      rollTrigger={rollTrigger}
      onRoll={onRollClick}
      onSelectMove={handleSelectMove}
      backHref="/"
      canRoll={canRoll}
      autoResolveRolled
      isPresentingDice={isPresentingDice}
      localPlayerId={activePlayerId}
      runeView={runeView}
      onDrawCards={handleDrawCards}
      onConfirmDraw={handleConfirmDraw}
      onFinishDraw={handleFinishDraw}
      onPlaceMarker={handlePlaceMarker}
      onConfirmPlacementReady={onConfirmPlacementReady}
      onUseLeaveStable={handleUseLeaveStableCard}
      onChooseSwap={handleChooseSwapTarget}
    />
  )
}
