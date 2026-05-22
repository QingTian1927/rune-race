import { useCallback, useEffect, useState } from 'react'
import type { LobbySnapshot, PlayerColor } from '@rune-race/shared'
import { getSocket } from '../lib/socket'

export function useLobbySocket(
  lobbyId: string,
  playerId: string,
  playerName: string,
  password?: string,
) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = getSocket()

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
  }, [lobbyId, playerId, playerName, password])

  const setColor = useCallback(
    (color: PlayerColor) => {
      getSocket().emit('lobby:set_color', { playerId, color })
    },
    [playerId],
  )

  const setReady = useCallback(
    (ready: boolean) => {
      getSocket().emit(ready ? 'lobby:ready' : 'lobby:unready', { playerId })
    },
    [playerId],
  )

  const leave = useCallback(() => {
    getSocket().emit('lobby:leave', { playerId })
  }, [playerId])

  const kick = useCallback(
    (targetPlayerId: string) => {
      getSocket().emit('lobby:kick', { playerId, targetPlayerId })
    },
    [playerId],
  )

  const cancelCountdown = useCallback(() => {
    getSocket().emit('lobby:cancel_countdown', { playerId })
  }, [playerId])

  const updateSettings = useCallback(
    (patch: { name?: string; password?: string; clearPassword?: boolean }) => {
      getSocket().emit('lobby:update_settings', { playerId, ...patch })
    },
    [playerId],
  )

  const transferHost = useCallback(
    (newHostPlayerId: string) => {
      getSocket().emit('lobby:transfer_host', { playerId, newHostPlayerId })
    },
    [playerId],
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
