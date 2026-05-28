import { useParams } from 'react-router-dom'
import GameView from '../components/GameView'
import { useGameSocket } from '../hooks/useGameSocket'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'

export default function OnlineGamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { playerId, accessToken } = usePlayerIdentity()
  const lobbyId = sessionStorage.getItem('rune-race-lobby-id')

  const { gameState, error, connected, rollTrigger, roll, chooseMove, isPresentingDice } =
    useGameSocket(gameId ?? '', playerId, accessToken)

  if (!gameId) {
    return <div className="p-8 text-white">Missing game id</div>
  }

  if (!gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        {connected ? 'Loading game...' : 'Connecting...'}
      </div>
    )
  }

  const me = gameState.players.find((p) => p.id === playerId)
  const isMyTurn = gameState.turn.currentPlayerId === playerId
  const canRoll =
    isMyTurn &&
    !isPresentingDice &&
    gameState.status === 'playing' &&
    gameState.turn.phase === 'waiting_roll'

  return (
    <GameView
      gameState={gameState}
      rollTrigger={rollTrigger}
      onRoll={roll}
      onSelectMove={chooseMove}
      backHref={lobbyId ? `/lobby/${lobbyId}` : '/'}
      error={error}
      banner={me ? (isMyTurn ? 'Luot cua ban' : 'Cho luot doi thu') : undefined}
      canRoll={canRoll}
      isPresentingDice={isPresentingDice}
      localPlayerId={playerId}
    />
  )
}
