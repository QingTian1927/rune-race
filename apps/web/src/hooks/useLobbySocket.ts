import { useCallback, useEffect, useRef, useState } from 'react'
import type { LobbySnapshot, PlayerColor } from '@rune-race/shared'
import {
  emitLeaveLobby,
  getSocket,
  retainLobbyOnUnmount,
} from '../lib/socket'

export type LobbyRemovalReason = 'closed' | 'kicked' | 'disconnect_timeout'

export function useLobbySocket(
  lobbyId: string,
  playerId: string,
  playerName: string,
  password?: string,
  authToken?: string | null,
  options?: {
    enabled?: boolean
    onRemoved?: (reason: LobbyRemovalReason) => void
  },
) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const enabled = options?.enabled ?? true
  const onRemoved = options?.onRemoved
  const onRemovedRef = useRef(onRemoved)
  onRemovedRef.current = onRemoved
  const playerNameRef = useRef(playerName)
  playerNameRef.current = playerName

  useEffect(() => {
    if (!enabled || !lobbyId || !playerId) {
      setConnected(false)
      return
    }

    const socket = getSocket(authToken)

    const onConnected = () => {
      socket.emit('lobby:join', {
        playerId,
        playerName: playerNameRef.current,
        lobbyId,
        password,
      })
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

    const onClosed = (payload: { lobbyId: string }) => {
      if (payload.lobbyId !== lobbyId) return
      setSnapshot(null)
      onRemovedRef.current?.('closed')
    }

    const onKicked = (payload: { lobbyId: string }) => {
      if (payload.lobbyId !== lobbyId) return
      setSnapshot(null)
      onRemovedRef.current?.('kicked')
    }

    const onTimedOut = (payload: { lobbyId: string }) => {
      if (payload.lobbyId !== lobbyId) return
      setSnapshot(null)
      onRemovedRef.current?.('disconnect_timeout')
    }

    const onGameStarted = (payload: { lobbyId: string }) => {
      if (payload.lobbyId === lobbyId) {
        retainLobbyOnUnmount(lobbyId)
      }
    }

    if (socket.connected) {
      onConnected()
    } else {
      socket.on('connect', onConnected)
    }

    socket.on('lobby:connected', onLobbyConnected)
    socket.on('lobby:snapshot', onSnapshot)
    socket.on('lobby:error', onLobbyError)
    socket.on('lobby:closed', onClosed)
    socket.on('lobby:kicked', onKicked)
    socket.on('lobby:removed', onTimedOut)
    socket.on('lobby:game_started', onGameStarted)

    return () => {
      socket.off('connect', onConnected)
      socket.off('lobby:connected', onLobbyConnected)
      socket.off('lobby:snapshot', onSnapshot)
      socket.off('lobby:error', onLobbyError)
      socket.off('lobby:closed', onClosed)
      socket.off('lobby:kicked', onKicked)
      socket.off('lobby:removed', onTimedOut)
      socket.off('lobby:game_started', onGameStarted)
    }
  }, [authToken, enabled, lobbyId, playerId, password])

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
    emitLeaveLobby(authToken, playerId)
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
