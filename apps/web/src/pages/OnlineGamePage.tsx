import { useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import GameView from '../components/GameView'
import { useGameSocket } from '../hooks/useGameSocket'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'
import { emitLeaveLobby, getSocket } from '../lib/socket'

export default function OnlineGamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { playerId, accessToken, avatarEmoji } = usePlayerIdentity()
  const lobbyId = sessionStorage.getItem('rune-race-lobby-id')

  const { gameState, connected, rollTrigger, roll, chooseMove, isPresentingDice } =
    useGameSocket(gameId ?? '', playerId, accessToken)

  const handleLeaveGame = useCallback(() => {
    emitLeaveLobby(accessToken, playerId)
    sessionStorage.removeItem('rune-race-lobby-id')
    navigate('/')
  }, [accessToken, navigate, playerId])

  useEffect(() => {
    if (!lobbyId) return
    const socket = getSocket(accessToken)

    const redirectHome = () => {
      sessionStorage.removeItem('rune-race-lobby-id')
      navigate('/')
    }

    const onClosed = (payload: { lobbyId: string }) => {
      if (payload.lobbyId === lobbyId) redirectHome()
    }
    const onKicked = (payload: { lobbyId: string }) => {
      if (payload.lobbyId === lobbyId) redirectHome()
    }
    const onRemoved = (payload: { lobbyId: string }) => {
      if (payload.lobbyId === lobbyId) redirectHome()
    }

    socket.on('lobby:closed', onClosed)
    socket.on('lobby:kicked', onKicked)
    socket.on('lobby:removed', onRemoved)

    return () => {
      socket.off('lobby:closed', onClosed)
      socket.off('lobby:kicked', onKicked)
      socket.off('lobby:removed', onRemoved)
    }
  }, [accessToken, lobbyId, navigate])

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
      canRoll={canRoll}
      isPresentingDice={isPresentingDice}
      localPlayerId={playerId}
      localAvatarEmoji={avatarEmoji}
      onLeave={handleLeaveGame}
    />
  )
}
