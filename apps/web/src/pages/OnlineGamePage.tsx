import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RoomChatPanel } from '../components/chat/RoomChatPanel'
import GameView from '../components/GameView'
import { useGameSocket } from '../hooks/useGameSocket'
import { usePlayerIdentity } from '../hooks/usePlayerIdentity'
import { useRoomChat } from '../hooks/useRoomChat'
import { emitLeaveLobby, getSocket } from '../lib/socket'

function GameLoadingScreen({ message }: { message: string }) {
  return (
    <div className="game-hud-loading-screen">
      <div className="game-hud-loading-card">
        <div className="game-hud-loading-spinner" aria-hidden />
        <p className="game-hud-loading-text">{message}</p>
      </div>
    </div>
  )
}

export default function OnlineGamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { playerId, playerName, accessToken, avatarEmoji, identityReady } = usePlayerIdentity()
  const lobbyId = sessionStorage.getItem('rune-race-lobby-id')
  const lobbyHref = lobbyId ? `/lobby/${lobbyId}` : '/'

  const {
    gameState,
    runeView,
    error,
    connected,
    rollTrigger,
    roll,
    chooseMove,
    drawCards,
    finishDraw,
    placeMarker,
    chooseSwap,
    isPresentingDice,
  } = useGameSocket(
    gameId ?? '',
    playerId,
    accessToken,
    lobbyId ? { lobbyId, playerName } : null,
  )

  const {
    messages: chatMessages,
    sendMessage: sendChatMessage,
    sendError: chatSendError,
    clearSendError: clearChatSendError,
  } = useRoomChat(lobbyId ?? undefined, playerId, accessToken, { enabled: identityReady })

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

  const canRoll = useMemo(() => {
    if (!gameState || isPresentingDice || gameState.status !== 'playing') return false
    if (gameState.turn.currentPlayerId !== playerId) return false

    const phase = gameState.turn.phase
    if (phase === 'waiting_roll') return true
    if (phase === 'placement_phase' || phase === 'waiting_draw') return true

    return false
  }, [gameState, isPresentingDice, playerId])

  if (!gameId) {
    return <GameLoadingScreen message="Thiếu mã game." />
  }

  if (!gameState) {
    return (
      <GameLoadingScreen message={connected ? 'Đang tải game…' : 'Đang kết nối…'} />
    )
  }

  return (
    <GameView
      gameState={gameState}
      rollTrigger={rollTrigger}
      onRoll={roll}
      onSelectMove={chooseMove}
      backHref={lobbyHref}
      canRoll={canRoll}
      isPresentingDice={isPresentingDice}
      localPlayerId={playerId}
      localAvatarEmoji={avatarEmoji}
      onLeave={handleLeaveGame}
      runeView={runeView}
      onDrawCards={drawCards}
      onFinishDraw={finishDraw}
      onPlaceMarker={placeMarker}
      onChooseSwap={chooseSwap}
      gameActionError={error}
      roomChat={
        lobbyId ? (
          <RoomChatPanel
            messages={chatMessages}
            localPlayerId={playerId}
            onSend={sendChatMessage}
            sendError={chatSendError}
            onClearSendError={clearChatSendError}
            placement="game"
          />
        ) : null
      }
    />
  )
}
