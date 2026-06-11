import { useCallback, useEffect, useState } from 'react'
import type { ClientGameSnapshot, RuneClientView } from '@rune-race/shared'
import { getSocket } from '../lib/socket'
import { usePresentationGameState } from './usePresentationGameState'

type LobbyPresence = {
  lobbyId: string
  playerName: string
}

export function useGameSocket(
  gameId: string,
  playerId: string,
  authToken?: string | null,
  lobbyPresence?: LobbyPresence | null,
) {
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [runeView, setRuneView] = useState<RuneClientView | null>(null)
  const { displayState, isPresentingDice, rollTrigger, applyAuthoritativeState } =
    usePresentationGameState()

  useEffect(() => {
    if (!gameId || !playerId) {
      setConnected(false)
      return
    }

    const socket = getSocket(authToken)

    const join = () => {
      socket.emit('game:join', { playerId, gameId })
      if (lobbyPresence?.lobbyId) {
        socket.emit('lobby:join', {
          playerId,
          playerName: lobbyPresence.playerName,
          lobbyId: lobbyPresence.lobbyId,
        })
      }
    }

    const onGameConnected = () => {
      setConnected(true)
      setError(null)
    }

    const onSnapshot = (payload: ClientGameSnapshot) => {
      applyAuthoritativeState(payload.state, { deltaEvents: payload.events })
      setRuneView(payload.runeView)
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
  }, [applyAuthoritativeState, authToken, gameId, lobbyPresence?.lobbyId, lobbyPresence?.playerName, playerId])

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

  const drawCards = useCallback(
    (count: number) => {
      getSocket(authToken).emit('game:draw_cards', { playerId, count })
    },
    [authToken, playerId],
  )

  const confirmDraw = useCallback(() => {
    getSocket(authToken).emit('game:confirm_draw', { playerId })
  }, [authToken, playerId])

  const finishDraw = useCallback(() => {
    getSocket(authToken).emit('game:finish_draw', { playerId })
  }, [authToken, playerId])

  const placeMarker = useCallback(
    (heldCardId: string, cellId: number, displayedIdentityId: string) => {
      getSocket(authToken).emit('game:place_marker', {
        playerId,
        heldCardId,
        cellId,
        displayedIdentityId,
      })
    },
    [authToken, playerId],
  )

  const confirmPlacementReady = useCallback(() => {
    getSocket(authToken).emit('game:confirm_placement_ready', { playerId })
  }, [authToken, playerId])

  const useLeaveStable = useCallback(
    (heldCardId: string) => {
      getSocket(authToken).emit('game:use_leave_stable', { playerId, heldCardId })
    },
    [authToken, playerId],
  )

  const selectHonestyReward = useCallback(
    (cardType: string) => {
      getSocket(authToken).emit('game:select_honesty_reward', { playerId, cardType })
    },
    [authToken, playerId],
  )

  const chooseSwap = useCallback(
    (targetTokenId: string) => {
      getSocket(authToken).emit('game:choose_swap', { playerId, targetTokenId })
    },
    [authToken, playerId],
  )

  return {
    gameState: displayState,
    runeView,
    isPresentingDice,
    error,
    connected,
    rollTrigger,
    roll,
    chooseMove,
    drawCards,
    confirmDraw,
    finishDraw,
    placeMarker,
    confirmPlacementReady,
    useLeaveStable,
    selectHonestyReward,
    chooseSwap,
  }
}
