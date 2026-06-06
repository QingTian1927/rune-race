import { useMemo, useRef } from 'react'
import type { RuneClientView } from '@rune-race/shared'
import {
  handleChooseMove,
  handleChooseSwap,
  handleDrawCards,
  handleFinishDraw,
  handlePlaceMarker,
  handleRoll as engineHandleRoll,
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
    const result = handleDrawCards(displayState, localPlayerId, count)
    if (result.success) apply(result.state)
  }

  const handleFinishDraw = () => {
    const result = handleFinishDraw(displayState, localPlayerId)
    if (result.success) apply(result.state)
  }

  const handlePlaceMarker = (
    heldCardId: string,
    cellId: number,
    displayedIdentityId: string,
  ) => {
    const result = handlePlaceMarker(
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

  const canRoll = useMemo(() => {
    if (isPresentingDice || displayState.status !== 'playing') return false
    if (displayState.turn.currentPlayerId !== activePlayerId) return false
    const phase = displayState.turn.phase
    if (phase === 'waiting_roll') return true
    if (phase === 'placement_phase' || phase === 'waiting_draw') return true
    return false
  }, [displayState, isPresentingDice])

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
      onFinishDraw={handleFinishDraw}
      onPlaceMarker={handlePlaceMarker}
      onChooseSwap={handleChooseSwapTarget}
    />
  )
}
