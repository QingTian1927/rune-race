import { useCallback, useEffect, useState } from 'react'
import type { GameState } from '@rune-race/shared'
import { getSocket } from '../lib/socket'
import { usePresentationGameState } from './usePresentationGameState'

export function useGameSocket(gameId: string, playerId: string, authToken?: string | null) {
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const { displayState, isPresentingDice, rollTrigger, applyAuthoritativeState } =
    usePresentationGameState()

  useEffect(() => {
    const socket = getSocket(authToken)

    const join = () => {
      socket.emit('game:join', { playerId, gameId })
    }

    const onGameConnected = () => {
      setConnected(true)
      setError(null)
    }

    const onSnapshot = (payload: { state: GameState; events: GameState['events'] }) => {
      applyAuthoritativeState(payload.state, { deltaEvents: payload.events })
    }

    const onGameError = (payload: { message: string }) => {
      setError(payload.message)
    }

    if (socket.connected) {
      join()
    } else {
      socket.on('connect', join)
    }

    socket.on('game:connected', onGameConnected)
    socket.on('game:state_snapshot', onSnapshot)
    socket.on('game:error', onGameError)

    return () => {
      socket.off('connect', join)
      socket.off('game:connected', onGameConnected)
      socket.off('game:state_snapshot', onSnapshot)
      socket.off('game:error', onGameError)
    }
  }, [applyAuthoritativeState, authToken, gameId, playerId])

  const roll = useCallback(() => {
    if (isPresentingDice) return
    getSocket(authToken).emit('game:roll', { playerId })
  }, [authToken, isPresentingDice, playerId])

  const chooseMove = useCallback(
    (moveId: string) => {
      if (isPresentingDice) return
      getSocket(authToken).emit('game:choose_move', { playerId, moveId })
    },
    [authToken, isPresentingDice, playerId],
  )

  return {
    gameState: displayState,
    isPresentingDice,
    error,
    connected,
    rollTrigger,
    roll,
    chooseMove,
  }
}
