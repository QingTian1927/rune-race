import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, ChatSystemEvent, PlayerColor } from '@rune-race/shared'
import { buildClientGameSnapshot, validateCommand } from '@rune-race/shared'
import type { ChatStore } from '../chat/chat-store'
import type { LobbyStore } from '../lobby/lobby-store'
import type { GameStore } from '../game/game-store'
import type { AnalyticsService } from '../analytics/service'
import type { MatchmakingQueue } from '../http/matchmaking'
import { isUuidLike } from '../analytics/event-writer'
import { ensureProfileRow } from '../lib/ensure-profile'
import { getSupabaseAdminClient, getUserFromAccessToken } from '../lib/supabase-server'
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

function broadcastSystemChat(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  chatStore: ChatStore,
  lobbyId: string,
  player: { id: string; name: string; color: PlayerColor | null },
  systemEvent: ChatSystemEvent,
): void {
  const message = chatStore.pushSystemEvent({
    lobbyId,
    playerId: player.id,
    playerName: player.name,
    playerColor: player.color,
    systemEvent,
  })
  io.to(`lobby:${lobbyId}`).emit('chat:message', message)
}

function resolvePlayerId(socket: AppSocket, claimedPlayerId: string): string {
  const { userId } = socket.data as AuthSocketData
  return userId ?? claimedPlayerId
}

function emitHostRoomPassword(
  registry: PlayerSocketRegistry,
  lobbyStore: LobbyStore,
  lobbyId: string,
  hostPlayerId: string,
): void {
  const roomPassword = lobbyStore.getHostRoomPassword(lobbyId, hostPlayerId)
  for (const target of registry.getSockets(hostPlayerId)) {
    target.emit('lobby:host_secrets', { roomPassword })
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
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  chatStore: ChatStore,
  registry: PlayerSocketRegistry,
  lobbyStore: LobbyStore,
  gameStore: GameStore,
  lobbyId: string,
  playerId: string,
  options: {
    forfeitGame: boolean
    notify?: { reason: 'kicked' | 'disconnect_timeout' }
    leavingSocket?: AppSocket
    announceChat?: boolean
  },
): void {
  const snapshot = lobbyStore.getSnapshot(lobbyId)
  const player = snapshot?.players.find((p) => p.id === playerId)

  if (options.forfeitGame) {
    forfeitPlayerInActiveGame(lobbyStore, gameStore, playerId)
  }

  if (options.announceChat !== false && player && snapshot) {
    const systemEvent: ChatSystemEvent =
      snapshot.status === 'in_game' ? 'player_left_game' : 'player_left'
    broadcastSystemChat(io, chatStore, lobbyId, player, systemEvent)
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
  analyticsService: AnalyticsService,
  matchmakingQueue?: MatchmakingQueue,
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
      matchmakingQueue?.clearMatchesForLobby(lobbyId)
      io.to(`lobby:${lobbyId}`).emit('lobby:closed', { lobbyId, reason: 'empty' })
    },
    onPlayerTimedOut: (lobbyId, player, { wasInGame }) => {
      notifyPlayerRemoved(socketRegistry, lobbyId, player.id, 'disconnect_timeout')
      analyticsService.onLobbyLeft(player.id, lobbyId, 'disconnect_timeout')
      if (socketRegistry.getSockets(player.id).length === 0) {
        analyticsService.onPresenceDisconnected(player.id, lobbyId, 'disconnect_timeout')
      }
      if (wasInGame) {
        analyticsService.onGameForfeit(
          lobbyStore.getSnapshot(lobbyId)?.currentGameId ?? '',
          lobbyId,
          player.id,
        )
      }
      void analyticsService.syncCounters(lobbyStore.getActiveLobbyCount(), gameStore.getActiveGameCount())
      if (!wasInGame) {
        broadcastSystemChat(io, chatStore, lobbyId, player, 'player_left')
      }
    },
    onGameStart: ({ lobbyId, gameId, players, firstPlayerId }) => {
      lobbyStore.setInGame(lobbyId, gameId)
      const lobbySnapshot = lobbyStore.getSnapshot(lobbyId)
      const runesEnabled = lobbySnapshot?.settings.runesEnabled ?? true
      const state = gameStore.createGame({ gameId, lobbyId, players, firstPlayerId, runesEnabled })
      analyticsService.onGameStarted(
        gameId,
        lobbyId,
        players.map((player) => player.id),
      )
      void analyticsService.syncCounters(lobbyStore.getActiveLobbyCount(), gameStore.getActiveGameCount())

      io.to(`lobby:${lobbyId}`).emit('lobby:game_started', {
        gameId,
        lobbyId,
        firstPlayerId,
      })

      io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', lobbyStore.getSnapshot(lobbyId)!)

      broadcastGameSnapshot(io, gameId, state, state.events)
    },
  })

  function broadcastGameSnapshot(
    server: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    gameId: string,
    state: import('@rune-race/shared').GameState,
    events: import('@rune-race/shared').GameEvent[],
  ) {
    void server.in(`game:${gameId}`).fetchSockets().then((sockets) => {
      for (const sock of sockets) {
        const playerId = (sock.data as { playerId?: string }).playerId
        if (!playerId) continue
        sock.emit('game:state_snapshot', buildClientGameSnapshot(state, playerId, events))
      }
    })
  }

  gameStore.setListeners({
    onChange: (gameId, state, events) => {
      broadcastGameSnapshot(io, gameId, state, events)
    },
    onFinished: (gameId, lobbyId, state) => {
      broadcastGameSnapshot(io, gameId, state, state.events)
      lobbyStore.resetAfterGame(lobbyId)
      analyticsService.onGameFinished(gameId, lobbyId, state)
      void analyticsService.syncCounters(lobbyStore.getActiveLobbyCount(), gameStore.getActiveGameCount())
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
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const priorLobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        const snapshot = lobbyStore.joinLobby({
          lobbyId: cmd.lobbyId,
          joinCode: cmd.joinCode,
          playerId: playerId,
          playerName: cmd.playerName,
          password: cmd.password,
        })
        trackLobby(snapshot.lobbyId, playerId)

        if (isUuidLike(playerId)) {
          const supabase = getSupabaseAdminClient()
          if (supabase) void ensureProfileRow(supabase, playerId)
        }

        analyticsService.onPresenceConnected(playerId, snapshot.lobbyId)
        analyticsService.onLobbyJoined(playerId, snapshot.lobbyId)
        void analyticsService.syncCounters(lobbyStore.getActiveLobbyCount(), gameStore.getActiveGameCount())
        socket.emit('lobby:connected', { playerId, lobbyId: snapshot.lobbyId })

        const { userId } = socket.data as AuthSocketData
        if (userId) {
          lobbyStore.removeLegacyLocalAnonPlayers(snapshot.lobbyId)
        }
        const latestSnapshot = lobbyStore.getSnapshot(snapshot.lobbyId) ?? snapshot
        io.to(`lobby:${snapshot.lobbyId}`).emit('lobby:snapshot', latestSnapshot)

        if (latestSnapshot.players.find((p) => p.id === playerId)?.isHost) {
          emitHostRoomPassword(socketRegistry, lobbyStore, snapshot.lobbyId, playerId)
        }

        const isReconnect = priorLobbyId === snapshot.lobbyId
        if (!isReconnect) {
          const player = latestSnapshot.players.find((p) => p.id === playerId)
          if (player) {
            broadcastSystemChat(io, chatStore, snapshot.lobbyId, player, 'player_joined')
          }
        }
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Join failed', 'JOIN_FAILED')
      }
    })

    socket.on('lobby:set_color', (payload) => {
      try {
        const cmd = validateCommand('lobby:set_color', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.setColor(lobbyId, playerId, cmd.color)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'SET_COLOR_FAILED')
      }
    })

    socket.on('lobby:ready', (payload) => {
      try {
        const cmd = validateCommand('lobby:ready', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const wasCountdown = lobbyStore.getSnapshot(lobbyId)?.status === 'countdown'
        const snapshot = lobbyStore.setReady(lobbyId, playerId, true)
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
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.setReady(lobbyId, playerId, false)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
        io.to(`lobby:${lobbyId}`).emit('lobby:start_countdown_cancelled', { reason: 'player_unready' })
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'UNREADY_FAILED')
      }
    })

    socket.on('lobby:leave', (payload) => {
      try {
        const cmd = validateCommand('lobby:leave', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        if (!lobbyId) return
        const lobbySnapshot = lobbyStore.getSnapshot(lobbyId)
        const forfeitGameId =
          lobbySnapshot?.status === 'in_game' ? lobbySnapshot.currentGameId : undefined
        removePlayerImmediately(
          io,
          chatStore,
          socketRegistry,
          lobbyStore,
          gameStore,
          lobbyId,
          playerId,
          {
            forfeitGame: true,
            leavingSocket: socket,
          },
        )
        analyticsService.onLobbyLeft(playerId, lobbyId, 'leave')
        if (forfeitGameId) {
          analyticsService.onGameForfeit(forfeitGameId, lobbyId, playerId)
        }
        void analyticsService.syncCounters(lobbyStore.getActiveLobbyCount(), gameStore.getActiveGameCount())
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'LEAVE_FAILED')
      }
    })

    socket.on('lobby:kick', (payload) => {
      try {
        const cmd = validateCommand('lobby:kick', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.getSnapshot(lobbyId)
        const target = snapshot?.players.find((p) => p.id === cmd.targetPlayerId)
        notifyPlayerRemoved(socketRegistry, lobbyId, cmd.targetPlayerId, 'kicked')
        lobbyStore.kickPlayer(lobbyId, playerId, cmd.targetPlayerId)
        analyticsService.onLobbyLeft(cmd.targetPlayerId, lobbyId, 'kick')
        void analyticsService.syncCounters(lobbyStore.getActiveLobbyCount(), gameStore.getActiveGameCount())
        if (target) {
          broadcastSystemChat(io, chatStore, lobbyId, target, 'player_left')
        }
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'KICK_FAILED')
      }
    })

    socket.on('lobby:cancel_countdown', (payload) => {
      try {
        const cmd = validateCommand('lobby:cancel_countdown', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.cancelCountdownByHost(lobbyId, playerId)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
        io.to(`lobby:${lobbyId}`).emit('lobby:start_countdown_cancelled', { reason: 'host_cancelled' })
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'CANCEL_FAILED')
      }
    })

    socket.on('lobby:update_settings', (payload) => {
      try {
        const cmd = validateCommand('lobby:update_settings', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.updateSettings(lobbyId, playerId, {
          name: cmd.name,
          password: cmd.password,
          clearPassword: cmd.clearPassword,
          runesEnabled: cmd.runesEnabled,
        })
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
        emitHostRoomPassword(socketRegistry, lobbyStore, lobbyId, playerId)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'SETTINGS_FAILED')
      }
    })

    socket.on('lobby:transfer_host', (payload) => {
      try {
        const cmd = validateCommand('lobby:transfer_host', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
        if (!lobbyId) throw new Error('Not in a lobby')
        const snapshot = lobbyStore.transferHost(lobbyId, playerId, cmd.newHostPlayerId)
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', snapshot)
        emitHostRoomPassword(socketRegistry, lobbyStore, lobbyId, cmd.newHostPlayerId)
      } catch (error) {
        lobbyError(socket, error instanceof Error ? error.message : 'Failed', 'TRANSFER_FAILED')
      }
    })

    socket.on('lobby:sync_request', (payload) => {
      try {
        const cmd = validateCommand('lobby:sync_request', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const lobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
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
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const message = chatStore.send({
          lobbyId: cmd.lobbyId,
          playerId: playerId,
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
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const memberLobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
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
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const state = gameStore.getState(cmd.gameId)
        if (!state) throw new Error('Game not found')
        const player = state.players.find((p) => p.id === playerId)
        if (!player) {
          throw new Error('Player not in this game')
        }
        socket.join(`game:${cmd.gameId}`)
        socketRegistry.track(socket, playerId)
        ;(socket.data as { gameId?: string; playerId?: string }).gameId = cmd.gameId
        ;(socket.data as { playerId?: string }).playerId = playerId

        const lobbyId = gameStore.getLobbyId(cmd.gameId)
        if (lobbyId) {
          try {
            lobbyStore.joinLobby({
              lobbyId,
              playerId,
              playerName: player.name,
            })
            trackLobby(lobbyId, playerId)
          } catch {
            const memberLobbyId = lobbyStore.getLobbyIdForPlayer(playerId)
            if (memberLobbyId === lobbyId) {
              trackLobby(lobbyId, playerId)
            }
          }
        }

        socket.emit('game:connected', { playerId: playerId, gameId: cmd.gameId })
        socket.emit(
          'game:state_snapshot',
          buildClientGameSnapshot(state, playerId, state.events),
        )
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Join failed', 'JOIN_FAILED')
      }
    })

    socket.on('game:roll', (payload) => {
      try {
        const cmd = validateCommand('game:roll', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.roll(gameId, playerId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Roll failed', 'ROLL_FAILED')
      }
    })

    socket.on('game:choose_move', (payload) => {
      try {
        const cmd = validateCommand('game:choose_move', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.chooseMove(gameId, playerId, cmd.moveId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Move failed', 'MOVE_FAILED')
      }
    })

    socket.on('game:draw_cards', (payload) => {
      try {
        const cmd = validateCommand('game:draw_cards', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.drawCards(gameId, playerId, cmd.count)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Draw failed', 'DRAW_FAILED')
      }
    })

    socket.on('game:confirm_draw', (payload) => {
      try {
        const cmd = validateCommand('game:confirm_draw', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.confirmDraw(gameId, playerId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Confirm draw failed', 'CONFIRM_DRAW_FAILED')
      }
    })

    socket.on('game:finish_draw', (payload) => {
      try {
        const cmd = validateCommand('game:finish_draw', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.finishDraw(gameId, playerId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Finish draw failed', 'FINISH_DRAW_FAILED')
      }
    })

    socket.on('game:place_marker', (payload) => {
      try {
        const cmd = validateCommand('game:place_marker', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.placeMarker(gameId, playerId, cmd.heldCardId, cmd.cellId, cmd.displayedIdentityId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Place failed', 'PLACE_FAILED')
      }
    })

    socket.on('game:confirm_placement_ready', (payload) => {
      try {
        const cmd = validateCommand('game:confirm_placement_ready', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.confirmPlacementReady(gameId, playerId)
      } catch (error) {
        gameError(
          socket,
          error instanceof Error ? error.message : 'Confirm placement failed',
          'CONFIRM_PLACEMENT_FAILED',
        )
      }
    })

    socket.on('game:use_leave_stable', (payload) => {
      try {
        const cmd = validateCommand('game:use_leave_stable', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.useLeaveStable(gameId, playerId, cmd.heldCardId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Leave stable failed', 'LEAVE_STABLE_FAILED')
      }
    })

    socket.on('game:choose_swap', (payload) => {
      try {
        const cmd = validateCommand('game:choose_swap', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const gameId = gameStore.getGameIdForPlayer(playerId)
        if (!gameId) throw new Error('Not in a game')
        gameStore.chooseSwap(gameId, playerId, cmd.targetTokenId)
      } catch (error) {
        gameError(socket, error instanceof Error ? error.message : 'Swap failed', 'SWAP_FAILED')
      }
    })

    socket.on('game:sync_request', (payload) => {
      try {
        const cmd = validateCommand('game:sync_request', payload)
        const playerId = resolvePlayerId(socket, cmd.playerId)
        const data = socket.data as { gameId?: string }
        const gameId = gameStore.getGameIdForPlayer(playerId) ?? data.gameId
        if (!gameId) throw new Error('Not in a game')
        const state = gameStore.getState(gameId)
        if (!state) throw new Error('Game not found')
        socket.emit(
          'game:state_snapshot',
          buildClientGameSnapshot(state, playerId, state.events),
        )
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
      socketRegistry.untrack(socket)

      if (!data.lobbyId || !data.playerId) return

      const { lobbyId, playerId } = data
      const stillConnected = socketRegistry.getSockets(playerId).length > 0
      if (stillConnected) return

      const snapshot = lobbyStore.getSnapshot(lobbyId)
      const player = snapshot?.players.find((p) => p.id === playerId)
      const forfeitGameId =
        snapshot?.status === 'in_game' ? snapshot.currentGameId : undefined

      if (player && snapshot?.status === 'in_game') {
        broadcastSystemChat(io, chatStore, lobbyId, player, 'player_left_game')
      }

      forfeitPlayerInActiveGame(lobbyStore, gameStore, playerId)
      lobbyStore.markDisconnected(lobbyId, playerId)

      analyticsService.onPresenceDisconnected(playerId, lobbyId, 'disconnect')
      if (forfeitGameId) {
        analyticsService.onGameForfeit(forfeitGameId, lobbyId, playerId)
      }
      void analyticsService.syncCounters(lobbyStore.getActiveLobbyCount(), gameStore.getActiveGameCount())

      const updatedSnapshot = lobbyStore.getSnapshot(lobbyId)
      if (updatedSnapshot) {
        io.to(`lobby:${lobbyId}`).emit('lobby:snapshot', updatedSnapshot)
        io.to(`lobby:${lobbyId}`).emit('lobby:start_countdown_cancelled', {
          reason: 'disconnect',
        })
      }
    })
  })
}
