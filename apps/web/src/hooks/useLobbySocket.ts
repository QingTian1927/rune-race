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
  const [hostRoomPassword, setHostRoomPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const enabled = options?.enabled ?? true
  const onRemoved = options?.onRemoved
  const onRemovedRef = useRef(onRemoved)
  onRemovedRef.current = onRemoved
  const playerNameRef = useRef(playerName)
  playerNameRef.current = playerName
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !lobbyId || !playerId) {
      return
    }

    const socket = getSocket(authToken)
    if (mountedRef.current) {
      setError(null)
    }

    const safeSetSnapshot = (value: LobbySnapshot | null) => {
      if (mountedRef.current) setSnapshot(value)
    }
    const safeSetHostRoomPassword = (value: string | null) => {
      if (mountedRef.current) setHostRoomPassword(value)
    }
    const safeSetError = (value: string | null) => {
      if (mountedRef.current) setError(value)
    }
    const safeSetConnected = (value: boolean) => {
      if (mountedRef.current) setConnected(value)
    }

    const onConnected = () => {
      const payload: {
        playerId: string
        playerName: string
        lobbyId: string
        password?: string
      } = {
        playerId,
        playerName: playerNameRef.current,
        lobbyId,
      }
      const trimmedPassword = password?.trim()
      if (trimmedPassword) {
        payload.password = trimmedPassword
      }
      socket.emit('lobby:join', payload)
    }

    const onLobbyConnected = () => {
      safeSetConnected(true)
      safeSetError(null)
    }

    const onSnapshot = (payload: LobbySnapshot) => {
      safeSetSnapshot(payload)
    }

    const onHostSecrets = (payload: { roomPassword: string | null }) => {
      safeSetHostRoomPassword(payload.roomPassword)
    }

    const onLobbyError = (payload: { message: string }) => {
      safeSetError(payload.message)
    }

    const onClosed = (payload: { lobbyId: string }) => {
      if (payload.lobbyId !== lobbyId) return
      safeSetSnapshot(null)
      onRemovedRef.current?.('closed')
    }

    const onKicked = (payload: { lobbyId: string }) => {
      if (payload.lobbyId !== lobbyId) return
      safeSetSnapshot(null)
      onRemovedRef.current?.('kicked')
    }

    const onTimedOut = (payload: { lobbyId: string }) => {
      if (payload.lobbyId !== lobbyId) return
      safeSetSnapshot(null)
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
    socket.on('lobby:host_secrets', onHostSecrets)
    socket.on('lobby:snapshot', onSnapshot)
    socket.on('lobby:error', onLobbyError)
    socket.on('lobby:closed', onClosed)
    socket.on('lobby:kicked', onKicked)
    socket.on('lobby:removed', onTimedOut)
    socket.on('lobby:game_started', onGameStarted)

    return () => {
      socket.off('connect', onConnected)
      socket.off('lobby:connected', onLobbyConnected)
      socket.off('lobby:host_secrets', onHostSecrets)
      socket.off('lobby:snapshot', onSnapshot)
      socket.off('lobby:error', onLobbyError)
      socket.off('lobby:closed', onClosed)
      socket.off('lobby:kicked', onKicked)
      socket.off('lobby:removed', onTimedOut)
      socket.off('lobby:game_started', onGameStarted)
    }
  }, [authToken, enabled, lobbyId, playerId, password])

  useEffect(() => {
    if (enabled && lobbyId && playerId) return
    setConnected(false)
    setSnapshot(null)
    setHostRoomPassword(null)
    setError(null)
  }, [enabled, lobbyId, playerId])

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

  const addBot = useCallback(() => {
    getSocket(authToken).emit('lobby:add_bot', { playerId })
  }, [authToken, playerId])

  const cancelCountdown = useCallback(() => {
    getSocket(authToken).emit('lobby:cancel_countdown', { playerId })
  }, [authToken, playerId])

  const updateSettings = useCallback(
    (patch: {
      name?: string
      password?: string
      clearPassword?: boolean
      runesEnabled?: boolean
    }) => {
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
    hostRoomPassword,
    error,
    connected,
    setColor,
    setReady,
    leave,
    kick,
    addBot,
    cancelCountdown,
    updateSettings,
    transferHost,
  }
}
