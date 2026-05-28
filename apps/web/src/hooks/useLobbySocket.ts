import { useCallback, useEffect, useState } from 'react'
import type { LobbySnapshot, PlayerColor } from '@rune-race/shared'
import { getSocket } from '../lib/socket'

export function useLobbySocket(
  lobbyId: string,
  playerId: string,
  playerName: string,
  password?: string,
  authToken?: string | null,
) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = getSocket(authToken)

    const onConnected = () => {
      socket.emit('lobby:join', { playerId, playerName, lobbyId, password })
    }

    const onLobbyConnected = () => {
      setConnected(true)
      setError(null)
    }

    const onSnapshot = (payload: LobbySnapshot) => {
      setSnapshot(payload)
    }

    const onLobbyError = (payload: { message: string }) => {
      setError(payload.message)
    }

    if (socket.connected) {
      onConnected()
    } else {
      socket.on('connect', onConnected)
    }

    socket.on('lobby:connected', onLobbyConnected)
    socket.on('lobby:snapshot', onSnapshot)
    socket.on('lobby:error', onLobbyError)

    return () => {
      socket.off('connect', onConnected)
      socket.off('lobby:connected', onLobbyConnected)
      socket.off('lobby:snapshot', onSnapshot)
      socket.off('lobby:error', onLobbyError)
    }
  }, [authToken, lobbyId, playerId, playerName, password])

  const setColor = useCallback(
    (color: PlayerColor) => {
      getSocket(authToken).emit('lobby:set_color', { playerId, color })
    },
    [authToken, playerId],
  )

  const setReady = useCallback(
    (ready: boolean) => {
      getSocket(authToken).emit(ready ? 'lobby:ready' : 'lobby:unready', { playerId })
    },
    [authToken, playerId],
  )

  const leave = useCallback(() => {
    getSocket(authToken).emit('lobby:leave', { playerId })
  }, [authToken, playerId])

  const kick = useCallback(
    (targetPlayerId: string) => {
      getSocket(authToken).emit('lobby:kick', { playerId, targetPlayerId })
    },
    [authToken, playerId],
  )

  const cancelCountdown = useCallback(() => {
    getSocket(authToken).emit('lobby:cancel_countdown', { playerId })
  }, [authToken, playerId])

  const updateSettings = useCallback(
    (patch: { name?: string; password?: string; clearPassword?: boolean }) => {
      getSocket(authToken).emit('lobby:update_settings', { playerId, ...patch })
    },
    [authToken, playerId],
  )

  const transferHost = useCallback(
    (newHostPlayerId: string) => {
      getSocket(authToken).emit('lobby:transfer_host', { playerId, newHostPlayerId })
    },
    [authToken, playerId],
  )

  return {
    snapshot,
    error,
    connected,
    setColor,
    setReady,
    leave,
    kick,
    cancelCountdown,
    updateSettings,
    transferHost,
  }
}
