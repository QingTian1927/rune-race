import { useRef } from 'react'
import GameView from '../components/GameView'
import getMockSnapshot from '../mock/getMockSnapshot'
import { rollMockTurn, resolveMockTurn } from '../mock/mockGameEngine'
import { usePresentationGameState } from '../hooks/usePresentationGameState'

export default function LocalGamePage() {
  const initial = useRef(getMockSnapshot()).current
  const { displayState, isPresentingDice, rollTrigger, applyAuthoritativeState } =
    usePresentationGameState(initial)

  if (!displayState) {
    return null
  }

  const handleRoll = () => {
    if (isPresentingDice) return
    const rolled = rollMockTurn(displayState)
    const delta = rolled.events.slice(displayState.events.length)
    applyAuthoritativeState(rolled, { deltaEvents: delta })
  }

  const handleSelectMove = (moveId: string) => {
    if (isPresentingDice) return
    const resolved = resolveMockTurn(displayState, moveId || undefined)
    const delta = resolved.events.slice(displayState.events.length)
    applyAuthoritativeState(resolved, { deltaEvents: delta })
  }

  return (
    <GameView
      gameState={displayState}
      rollTrigger={rollTrigger}
      onRoll={handleRoll}
      onSelectMove={handleSelectMove}
      backHref="/"
      autoResolveRolled
      isPresentingDice={isPresentingDice}
    />
  )
}
