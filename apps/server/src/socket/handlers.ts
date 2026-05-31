import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@rune-race/shared'
import { validateCommand } from '@rune-race/shared'
import type { ChatStore } from '../chat/chat-store'
import type { LobbyStore } from '../lobby/lobby-store'
import type { GameStore } from '../game/game-store'
import { getUserFromAccessToken } from '../lib/supabase-server'
import { PlayerSocketRegistry } from './player-socket-registry'

type AuthSocketData = {
  userId?: string
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>

function lobbyError(socket: AppSocket, message: string, code: string) {
  socket.emit('lobby:error', { message, code })
}

function gameError(socket: AppSocket, message: string, code: string) {
  socket.emit('game:error', { message, code })
}

function chatError(socket: AppSocket, message: string, code: string) {
  socket.emit('chat:error', { message, code })
}

function assertPlayerIdMatchesAuth(socket: AppSocket, playerId: string): void {
  const { userId } = socket.data as AuthSocketData
  if (userId && userId !== playerId) {
    throw new Error('Auth mismatch')
  }
}

function forfeitPlayerInActiveGame(
  lobbyStore: LobbyStore,
  gameStore: GameStore,
  playerId: string,
): void {
  const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
  if (!lobbyId) return

  const snapshot = lobbyStore.getSnapshot(lobbyId)
  if (snapshot?.status !== 'in_game' || !snapshot.currentGameId) return

  gameStore.removePlayer(snapshot.currentGameId, playerId)
}

function notifyPlayerRemoved(
  registry: PlayerSocketRegistry,
  lobbyId: string,
  playerId: string,
  reason: 'kicked' | 'disconnect_timeout',
): void {
  for (const socket of registry.getSockets(playerId)) {
    if (reason === 'kicked') {
      socket.emit('lobby:kicked', { lobbyId, reason: 'kicked' })
    } else {
      socket.emit('lobby:removed', { lobbyId, reason: 'disconnect_timeout' })
    }
    socket.leave(`lobby:${lobbyId}`)
    const data = socket.data as { lobbyId?: string }
    if (data.lobbyId === lobbyId) {
      delete data.lobbyId
    }
  }
}

function removePlayerImmediately(
  registry: PlayerSocketRegistry,
  lobbyStore: LobbyStore,
  gameStore: GameStore,
  lobbyId: string,
  playerId: string,
  options: {
    forfeitGame: boolean
    notify?: { reason: 'kicked' | 'disconnect_timeout' }
    leavingSocket?: AppSocket
  },
): void {
  if (options.forfeitGame) {
    forfeitPlayerInActiveGame(lobbyStore, gameStore, playerId)
  }

  if (options.notify) {
    notifyPlayerRemoved(registry, lobbyId, playerId, options.notify.reason)
  }

  const removed = lobbyStore.leaveLobby(lobbyId, playerId)

  if (options.leavingSocket) {
    options.leavingSocket.leave(`lobby:${lobbyId}`)
    const data = options.leavingSocket.data as { lobbyId?: string }
    if (data.lobbyId === lobbyId) {
      delete data.lobbyId
    }
  }

  if (!removed) return
}

export function setupSocketHandlers(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  lobbyStore: LobbyStore,
  gameStore: GameStore,
  chatStore: ChatStore,
): void {
  const socketRegistry = new PlayerSocketRegistry()

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next()
    const user = await getUserFromAccessToken(String(token))
    if (!user) return next(new Error('AUTH_INVALID'))
    ;(socket.data as AuthSocketData).userId = user.id
    return next()
  })

  lobbyStore.setListeners({
    onChange: (lobbyId, snapshot) => {
      io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
    },
    onDestroy: (lobbyId) => {
      chatStore.clearLobby(lobbyId)
      io.to(`lobby:${lobbyId}`).emit('lobby:closed', { lobbyId, reason: 'empty' })
    },
    onPlayerTimedOut: (lobbyId, playerId) => {
      notifyPlayerRemoved(socketRegistry, lobbyId, playerId, 'disconnect_timeout')
    },
    onGameStart: ({ lobbyId, gameId, players, firstPlayerId }) => {
      lobbyStore.setInGame(lobbyId, gameId)
      const state = gameStore.createGame({ gameId, lobbyId, players, firstPlayerId })

      io.to(`lobby:${lobbyId}`).emit('lobby:game_started', {
        gameId,
        lobbyId,
        firstPlayerId,
      })

      io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', lobbyStore.getSnapshot(lobbyId)!)

      io.to(`game:${gameId}`).emit('game:state_snapshot', {
        version: state.version,
        state,
        events: state.events,
      })
    },
  })

  gameStore.setListeners({
    onChange: (gameId, state, events) => {
      io.to(`game:${gameId}`).emit('game:state_snapshot', {
        version: state.version,
        state,
        events,
      })
    },
    onFinished: (gameId, lobbyId, state) => {
      io.to(`game:${gameId}`).emit('game:state_snapshot', {
        version: state.version,
        state,
        events: state.events,
      })
      lobbyStore.resetAfterGame(lobbyId)
    },
  })

  io.on('connection', (socket) => {
    const trackLobby = (lobbyId: string, playerId: string) => {
      socket.join(`lobby:${lobbyId}`)
      const data = socket.data as { lobbyId?: string; playerId?: string; gameId?: string }
      data.lobbyId = lobbyId
      data.playerId = playerId
      socketRegistry.track(socket, playerId)
      lobbyStore.markConnected(lobbyId, playerId)
    }

    socket.on('lobby:join', (payload) => {
      try {
        const cmd = validateCommand('lobby:join', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const snapshot = lobbyStore.joinLobby({
          lobbyId: cmd.lobbyId,
          joinCode: cmd.joinCode,
          playerId: cmd.playerId,
          playerName: cmd.playerName,
          password: cmd.password,
        })
        trackLobby(snapshot.lobbyId, cmd.playerId)
        socket.emit('lobby:connected', { playerId: cmd.playerId, lobbyId: snapshot.lobbyId })
        io.to(`lobby:${snapshot.lobbyId}`).emit('lobby:snapshot', snapshot)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Join failed', 'JOIN_FAILED')
      }
    })

    socket.on('lobby:set_color', (payload) => {
      try {
        const cmd = validateCommand('lobby:set_color', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.setColor(lobbyId, cmd.playerId, cmd.color)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'SET_COLOR_FAILED')
      }
    })

    socket.on('lobby:ready', (payload) => {
      try {
        const cmd = validateCommand('lobby:ready', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const wasCountdown = lobbyStore.getSnapshot(lobbyId)?.status === 'countdown'
        const snapshot = lobbyStore.setReady(lobbyId, cmd.playerId, true)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
        if (!wasCountdown && snapshot.status === 'countdown') {
          io.to(`lobby:${lobbyId}`).emit('lobby:start_countdown', { seconds: 5 })
        }
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'READY_FAILED')
      }
    })

    socket.on('lobby:unready', (payload) => {
      try {
        const cmd = validateCommand('lobby:unready', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.setReady(lobbyId, cmd.playerId, false)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
        io.to(`lobby:${lobbyId}`).emit('lobby:start_countdown_cancelled', { reason: 'player_unready' })
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'UNREADY_FAILED')
      }
    })

    socket.on('lobby:leave', (payload) => {
      try {
        const cmd = validateCommand('lobby:leave', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) return
        removePlayerImmediately(socketRegistry, lobbyStore, gameStore, lobbyId, cmd.playerId, {
          forfeitGame: true,
          leavingSocket: socket,
        })
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'LEAVE_FAILED')
      }
    })

    socket.on('lobby:kick', (payload) => {
      try {
        const cmd = validateCommand('lobby:kick', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        notifyPlayerRemoved(socketRegistry, lobbyId, cmd.targetPlayerId, 'kicked')
        lobbyStore.kickPlayer(lobbyId, cmd.playerId, cmd.targetPlayerId)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'KICK_FAILED')
      }
    })

    socket.on('lobby:cancel_countdown', (payload) => {
      try {
        const cmd = validateCommand('lobby:cancel_countdown', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.cancelCountdownByHost(lobbyId, cmd.playerId)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
        io.to(`lobby:${lobbyId}`).emit('lobby:start_countdown_cancelled', { reason: 'host_cancelled' })
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'CANCEL_FAILED')
      }
    })

    socket.on('lobby:update_settings', (payload) => {
      try {
        const cmd = validateCommand('lobby:update_settings', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.updateSettings(lobbyId, cmd.playerId, {
          name: cmd.name,
          password: cmd.password,
          clearPassword: cmd.clearPassword,
        })
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'SETTINGS_FAILED')
      }
    })

    socket.on('lobby:transfer_host', (payload) => {
      try {
        const cmd = validateCommand('lobby:transfer_host', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.transferHost(lobbyId, cmd.playerId, cmd.newHostPlayerId)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'TRANSFER_FAILED')
      }
    })

    socket.on('lobby:sync_request', (payload) => {
      try {
        const cmd = validateCommand('lobby:sync_request', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.getSnapshot(lobbyId)
        if (snapshot) socket.emit('lobby:snapshot', snapshot)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'SYNC_FAILED')
      }
    })

    socket.on('chat:send', (payload) => {
      try {
        const cmd = validateCommand('chat:send', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const message = chatStore.send({
          lobbyId: cmd.lobbyId,
          playerId: cmd.playerId,
          text: cmd.text,
          lobbyStore,
        })
        io.to(`lobby:${cmd.lobbyId}`).emit('chat:message', message)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Send failed'
        const code =
          message === 'Sending too fast'
            ? 'RATE_LIMITED'
            : message === 'Not in this lobby' || message === 'Player not in lobby'
              ? 'NOT_IN_LOBBY'
              : 'SEND_FAILED'
        chatError(socket, message, code)
      }
    })

    socket.on('chat:sync_request', (payload) => {
      try {
        const cmd = validateCommand('chat:sync_request', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const memberLobbyId = lobbyStore.getLobbyIdForPlayer(cmd.playerId)
        if (memberLobbyId !== cmd.lobbyId) {
          throw new Error('Not in this lobby')
        }
        socket.emit('chat:history', {
          lobbyId: cmd.lobbyId,
          messages: chatStore.getHistory(cmd.lobbyId),
        })
      } catch (error) {
        chatError(socket, error instanceof Error ? error.message : 'Sync failed', 'SYNC_FAILED')
      }
    })

    socket.on('game:join', (payload) => {
      try {
        const cmd = validateCommand('game:join', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const state = gameStore.getState(cmd.gameId)
        if (!state) throw new Error('Game not found')
        if (!state.players.some((p) => p.id === cmd.playerId)) {
          throw new Error('Player not in this game')
        }
        socket.join(`game:${cmd.gameId}`)
        socketRegistry.track(socket, cmd.playerId)
        ;(socket.data as { gameId?: string; playerId?: string }).gameId = cmd.gameId
        ;(socket.data as { playerId?: string }).playerId = cmd.playerId
        socket.emit('game:connected', { playerId: cmd.playerId, gameId: cmd.gameId })
        socket.emit('game:state_snapshot', { version: state.version, state, events: state.events })
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Join failed', 'JOIN_FAILED')
      }
    })

    socket.on('game:roll', (payload) => {
      try {
        const cmd = validateCommand('game:roll', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(cmd.playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.roll(gameId, cmd.playerId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Roll failed', 'ROLL_FAILED')
      }
    })

    socket.on('game:choose_move', (payload) => {
      try {
        const cmd = validateCommand('game:choose_move', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(cmd.playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.chooseMove(gameId, cmd.playerId, cmd.moveId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Move failed', 'MOVE_FAILED')
      }
    })

    socket.on('game:sync_request', (payload) => {
      try {
        const cmd = validateCommand('game:sync_request', payload)
        assertPlayerIdMatchesAuth(socket, cmd.playerId)
        const data = socket.data as { gameId?: string }
        const gameId = gameStore.getGameIdForPlayer(cmd.playerId) ?? data.gameId
        if (!gameId) throw new Error('Not in a game')
        const state = gameStore.getState(gameId)
        if (!state) throw new Error('Game not found')
        socket.emit('game:state_snapshot', { version: state.version, state, events: state.events })
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Sync failed', 'SYNC_FAILED')
      }
    })

    socket.on('game:ping', (payload) => {
      try {
        validateCommand('game:ping', payload)
      } catch {
        // ignore
      }
    })

    socket.on('disconnect', () => {
      socketRegistry.untrack(socket)

      const data = socket.data as { lobbyId?: string; playerId?: string }
      if (!data.lobbyId || !data.playerId) return

      const { lobbyId, playerId } = data
      forfeitPlayerInActiveGame(lobbyStore, gameStore, playerId)
      lobbyStore.markDisconnected(lobbyId, playerId)

      const snapshot = lobbyStore.getSnapshot(lobbyId)
      if (snapshot) {
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
        io.to(`lobby:${lobbyId}`).emit('lobby:start_countdown_cancelled', {
          reason: 'disconnect',
        })
      }
    })
  })
}
