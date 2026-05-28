import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@rune-race/shared'
import { validateCommand } from '@rune-race/shared'
import type { LobbyStore } from '../lobby/lobby-store'
import type { GameStore } from '../game/game-store'
import { getUserFromAccessToken } from '../lib/supabase-server'

type AuthSocketData = {
  userId?: string
}

function lobbyError(socket: Socket<ClientToServerEvents, ServerToClientEvents>, message: string, code: string) {
  socket.emit('lobby:error', { message, code })
}

function gameError(socket: Socket<ClientToServerEvents, ServerToClientEvents>, message: string, code: string) {
  socket.emit('game:error', { message, code })
}

function assertPlayerIdMatchesAuth(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  playerId: string,
): void {
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

export function setupSocketHandlers(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  lobbyStore: LobbyStore,
  gameStore: GameStore,
): void {
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
        forfeitPlayerInActiveGame(lobbyStore, gameStore, cmd.playerId)
        lobbyStore.leaveLobby(lobbyId, cmd.playerId)
        socket.leave(`lobby:${lobbyId}`)
        const snapshot = lobbyStore.getSnapshot(lobbyId)
        if (snapshot) io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
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
        const snapshot = lobbyStore.kickPlayer(lobbyId, cmd.playerId, cmd.targetPlayerId)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
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
        ;(socket.data as { gameId?: string }).gameId = cmd.gameId
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
      const data = socket.data as { lobbyId?: string; playerId?: string }
      if (data.lobbyId && data.playerId) {
        forfeitPlayerInActiveGame(lobbyStore, gameStore, data.playerId)
        lobbyStore.markDisconnected(data.lobbyId, data.playerId)
        const snapshot = lobbyStore.getSnapshot(data.lobbyId)
        if (snapshot) {
          io.to(`lobby:${data.lobbyId}`).emit('lobby:snapshot', snapshot)
          io.to(`lobby:${data.lobbyId}`).emit('lobby:start_countdown_cancelled', {
            reason: 'disconnect',
          })
        }
      }
    })
  })
}
