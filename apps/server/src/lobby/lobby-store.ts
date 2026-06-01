import { randomUUID } from 'node:crypto'
import type { Player, PlayerColor } from '@rune-race/shared'
import {
  LOBBY_DISCONNECT_GRACE_MS,
  LOBBY_MAX_PLAYERS,
  LOBBY_MIN_PLAYERS_TO_START,
  LOBBY_START_COUNTDOWN_SECONDS,
  type LobbyPlayer,
  type LobbySettings,
  type LobbySnapshot,
  type LobbyStatus,
} from '@rune-race/shared'
import { generateJoinCode } from '../lib/join-code'
import { hashPassword, verifyPassword } from '../lib/password'

export type LobbyVisibility = 'public' | 'private'

interface InternalLobbyPlayer extends LobbyPlayer {
  disconnectTimer: ReturnType<typeof setTimeout> | null
}

export interface LobbyRecord {
  lobbyId: string
  joinCode: string
  visibility: LobbyVisibility
  status: LobbyStatus
  settings: LobbySettings
  players: InternalLobbyPlayer[]
  passwordHash: string | null
  /** Plaintext for host display only — never included in lobby snapshots. */
  passwordPlaintext: string | null
  currentGameId: string | null
  countdownSeconds: number | null
  countdownTimer: ReturnType<typeof setInterval> | null
  hostPlayerId: string
}

export type LobbyChangeListener = (lobbyId: string, snapshot: LobbySnapshot) => void
export type LobbyDestroyListener = (lobbyId: string) => void
export type LobbyPlayerTimedOutListener = (
  lobbyId: string,
  player: { id: string; name: string; color: PlayerColor | null },
  context: { wasInGame: boolean },
) => void
export type GameStartListener = (payload: {
  lobbyId: string
  gameId: string
  players: Player[]
  firstPlayerId: string
}) => void

function buildSettings(name: string): LobbySettings {
  return {
    name,
    hasPassword: false,
    maxPlayers: LOBBY_MAX_PLAYERS,
    minPlayersToStart: LOBBY_MIN_PLAYERS_TO_START,
  }
}

const DEFAULT_LOBBY_CLEANUP_INTERVAL_MS = 30_000

export class LobbyStore {
  private lobbies = new Map<string, LobbyRecord>()
  private joinCodeIndex = new Map<string, string>()
  private playerLobbyIndex = new Map<string, string>()
  private onChange: LobbyChangeListener | null = null
  private onDestroy: LobbyDestroyListener | null = null
  private onPlayerTimedOut: LobbyPlayerTimedOutListener | null = null
  private onGameStart: GameStartListener | null = null
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  setListeners(listeners: {
    onChange?: LobbyChangeListener
    onDestroy?: LobbyDestroyListener
    onPlayerTimedOut?: LobbyPlayerTimedOutListener
    onGameStart?: GameStartListener
  }): void {
    this.onChange = listeners.onChange ?? null
    this.onDestroy = listeners.onDestroy ?? null
    this.onPlayerTimedOut = listeners.onPlayerTimedOut ?? null
    this.onGameStart = listeners.onGameStart ?? null
  }

  startCleanupTimer(intervalMs = DEFAULT_LOBBY_CLEANUP_INTERVAL_MS): void {
    if (this.cleanupTimer) return
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleLobbies()
    }, intervalMs)
  }

  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /** Removes empty lobbies and abandoned waiting rooms (no connected players). */
  cleanupStaleLobbies(): number {
    let removed = 0
    for (const lobbyId of [...this.lobbies.keys()]) {
      const record = this.lobbies.get(lobbyId)
      if (!record) continue

      if (record.players.length === 0) {
        this.destroyLobby(lobbyId)
        removed += 1
        continue
      }

      const anyConnected = record.players.some((p) => p.connected)
      if (!anyConnected && record.status === 'lobby') {
        this.destroyLobby(lobbyId)
        removed += 1
      }
    }
    return removed
  }

  createLobby(options: {
    hostPlayerId: string
    hostName: string
    name?: string
    password?: string
    visibility?: LobbyVisibility
  }): LobbySnapshot {
    const lobbyId = randomUUID()
    let joinCode = generateJoinCode()
    while (this.joinCodeIndex.has(joinCode)) {
      joinCode = generateJoinCode()
    }

    const settings = buildSettings(options.name ?? `Room ${joinCode}`)
    const roomPassword = options.password?.trim() || null
    const passwordHash = roomPassword ? hashPassword(roomPassword) : null
    if (passwordHash) {
      settings.hasPassword = true
    }

    const host: InternalLobbyPlayer = {
      id: options.hostPlayerId,
      name: options.hostName,
      color: null,
      ready: false,
      connected: false,
      isHost: true,
      disconnectTimer: null,
    }

    const record: LobbyRecord = {
      lobbyId,
      joinCode,
      visibility: options.visibility ?? 'public',
      status: 'lobby',
      settings,
      players: [host],
      passwordHash,
      passwordPlaintext: roomPassword,
      currentGameId: null,
      countdownSeconds: null,
      countdownTimer: null,
      hostPlayerId: options.hostPlayerId,
    }

    this.lobbies.set(lobbyId, record)
    this.joinCodeIndex.set(joinCode, lobbyId)
    this.playerLobbyIndex.set(options.hostPlayerId, lobbyId)

    const snapshot = this.toSnapshot(record)
    this.emitChange(lobbyId, snapshot)
    return snapshot
  }

  resolveLobbyId(lobbyId?: string, joinCode?: string): string | null {
    if (lobbyId && this.lobbies.has(lobbyId)) {
      return lobbyId
    }
    if (joinCode) {
      return this.joinCodeIndex.get(joinCode) ?? null
    }
    return null
  }

  getSnapshot(lobbyId: string): LobbySnapshot | null {
    const record = this.lobbies.get(lobbyId)
    return record ? this.toSnapshot(record) : null
  }

  listPublicLobbies(): LobbySnapshot[] {
    return [...this.lobbies.values()]
      .filter(
        (l) =>
          l.visibility === 'public' &&
          l.status === 'lobby' &&
          l.players.some((p) => p.connected),
      )
      .map((l) => this.toSnapshot(l))
  }

  joinLobby(params: {
    lobbyId?: string
    joinCode?: string
    playerId: string
    playerName: string
    password?: string
  }): LobbySnapshot {
    const id = this.resolveLobbyId(params.lobbyId, params.joinCode)
    if (!id) {
      throw new Error('Lobby not found')
    }

    const record = this.lobbies.get(id)!
    if (record.status === 'in_game') {
      throw new Error('Game already in progress')
    }

    const existing = record.players.find((p) => p.id === params.playerId)
    if (
      !existing &&
      record.passwordHash &&
      !verifyPassword(params.password ?? '', record.passwordHash)
    ) {
      throw new Error('Invalid password')
    }

    if (existing) {
      this.clearDisconnectTimer(existing)
      existing.connected = true
      existing.name = params.playerName
      this.playerLobbyIndex.set(params.playerId, id)
      const snapshot = this.toSnapshot(record)
      this.emitChange(id, snapshot)
      return snapshot
    }

    if (record.players.length >= LOBBY_MAX_PLAYERS) {
      throw new Error('Lobby is full')
    }

    record.players.push({
      id: params.playerId,
      name: params.playerName,
      color: null,
      ready: false,
      connected: false,
      isHost: false,
      disconnectTimer: null,
    })
    this.playerLobbyIndex.set(params.playerId, id)

    this.cancelCountdown(record, 'player_joined')
    const snapshot = this.toSnapshot(record)
    this.emitChange(id, snapshot)
    return snapshot
  }

  /** Drop ghost rows created by pre-auth socket joins (`anon-*` local ids). */
  removeLegacyLocalAnonPlayers(lobbyId: string): boolean {
    const record = this.lobbies.get(lobbyId)
    if (!record) return false

    const legacyIds = record.players
      .filter((p) => p.id.startsWith('anon-'))
      .map((p) => p.id)

    if (legacyIds.length === 0) return false

    let removedAny = false
    for (const id of legacyIds) {
      if (this.leaveLobby(lobbyId, id)) {
        removedAny = true
      }
    }
    return removedAny
  }

  setColor(lobbyId: string, playerId: string, color: PlayerColor): LobbySnapshot {
    const record = this.getLobbyOrThrow(lobbyId, playerId)
    if (record.status !== 'lobby') {
      throw new Error('Cannot change color while game is active')
    }

    if (record.players.some((p) => p.color === color && p.id !== playerId)) {
      throw new Error('Color already taken')
    }

    const player = this.getPlayerOrThrow(record, playerId)
    player.color = color
    player.ready = false
    this.cancelCountdown(record, 'color_changed')

    const snapshot = this.toSnapshot(record)
    this.emitChange(lobbyId, snapshot)
    return snapshot
  }

  setReady(lobbyId: string, playerId: string, ready: boolean): LobbySnapshot {
    const record = this.getLobbyOrThrow(lobbyId, playerId)
    if (record.status !== 'lobby') {
      throw new Error('Cannot change ready state during game')
    }

    const player = this.getPlayerOrThrow(record, playerId)
    if (!player.connected) {
      throw new Error('Must be connected to ready up')
    }
    if (!player.color) {
      throw new Error('Choose a color first')
    }

    player.ready = ready
    if (!ready) {
      this.cancelCountdown(record, 'player_unready')
    } else if (this.canStartCountdown(record)) {
      this.startCountdown(record)
    }

    const snapshot = this.toSnapshot(record)
    this.emitChange(lobbyId, snapshot)
    return snapshot
  }

  leaveLobby(lobbyId: string, playerId: string): boolean {
    const record = this.lobbies.get(lobbyId)
    if (!record) return false
    if (!record.players.some((p) => p.id === playerId)) return false

    this.removePlayer(record, playerId, 'left')
    if (record.players.length === 0) {
      this.destroyLobby(lobbyId)
      return true
    }

    this.emitChange(lobbyId, this.toSnapshot(record))
    return true
  }

  kickPlayer(lobbyId: string, hostId: string, targetId: string): LobbySnapshot | null {
    const record = this.getLobbyOrThrow(lobbyId, hostId)
    if (record.hostPlayerId !== hostId) {
      throw new Error('Only host can kick')
    }
    if (record.status !== 'lobby') {
      throw new Error('Cannot kick during a game')
    }
    if (targetId === hostId) {
      throw new Error('Host cannot kick themselves')
    }

    this.removePlayer(record, targetId, 'kicked')
    if (record.players.length === 0) {
      this.destroyLobby(lobbyId)
      return null
    }

    const snapshot = this.toSnapshot(record)
    this.emitChange(lobbyId, snapshot)
    return snapshot
  }

  cancelCountdownByHost(lobbyId: string, hostId: string): LobbySnapshot {
    const record = this.getLobbyOrThrow(lobbyId, hostId)
    if (record.hostPlayerId !== hostId) {
      throw new Error('Only host can cancel countdown')
    }
    this.cancelCountdown(record, 'host_cancelled')
    const snapshot = this.toSnapshot(record)
    this.emitChange(lobbyId, snapshot)
    return snapshot
  }

  updateSettings(
    lobbyId: string,
    hostId: string,
    patch: { name?: string; password?: string; clearPassword?: boolean },
  ): LobbySnapshot {
    const record = this.getLobbyOrThrow(lobbyId, hostId)
    if (record.hostPlayerId !== hostId) {
      throw new Error('Only host can update settings')
    }

    if (patch.name) {
      record.settings.name = patch.name
    }
    if (patch.clearPassword) {
      record.passwordHash = null
      record.passwordPlaintext = null
      record.settings.hasPassword = false
    } else if (patch.password) {
      const roomPassword = patch.password.trim()
      record.passwordHash = hashPassword(roomPassword)
      record.passwordPlaintext = roomPassword
      record.settings.hasPassword = true
    }

    const snapshot = this.toSnapshot(record)
    this.emitChange(lobbyId, snapshot)
    return snapshot
  }

  getHostRoomPassword(lobbyId: string, playerId: string): string | null {
    const record = this.lobbies.get(lobbyId)
    if (!record || record.hostPlayerId !== playerId) return null
    return record.passwordPlaintext
  }

  transferHost(lobbyId: string, hostId: string, newHostId: string): LobbySnapshot {
    const record = this.getLobbyOrThrow(lobbyId, hostId)
    if (record.hostPlayerId !== hostId) {
      throw new Error('Only host can transfer host')
    }
    const target = record.players.find((p) => p.id === newHostId)
    if (!target) {
      throw new Error('Target player not in lobby')
    }

    record.hostPlayerId = newHostId
    record.players.forEach((p) => {
      p.isHost = p.id === newHostId
    })

    const snapshot = this.toSnapshot(record)
    this.emitChange(lobbyId, snapshot)
    return snapshot
  }

  markDisconnected(lobbyId: string, playerId: string): void {
    const record = this.lobbies.get(lobbyId)
    if (!record) return

    const player = record.players.find((p) => p.id === playerId)
    if (!player || !player.connected) return

    player.connected = false
    player.ready = false
    this.cancelCountdown(record, 'disconnect')

    if (record.hostPlayerId === playerId && record.players.length > 1) {
      const nextHost = record.players.find((p) => p.connected && p.id !== playerId)
      if (nextHost) {
        record.hostPlayerId = nextHost.id
        record.players.forEach((p) => {
          p.isHost = p.id === nextHost.id
        })
      }
    }

    this.clearDisconnectTimer(player)
    player.disconnectTimer = setTimeout(() => {
      const current = this.lobbies.get(lobbyId)
      const currentPlayer = current?.players.find((p) => p.id === playerId)
      if (!current || !currentPlayer) return

      const wasInGame = current.status === 'in_game'
      const playerInfo = {
        id: currentPlayer.id,
        name: currentPlayer.name,
        color: currentPlayer.color,
      }

      if (!this.leaveLobbyAfterDisconnectTimeout(lobbyId, playerId)) return
      this.onPlayerTimedOut?.(lobbyId, playerInfo, { wasInGame })
    }, LOBBY_DISCONNECT_GRACE_MS)

    this.emitChange(lobbyId, this.toSnapshot(record))
  }

  /** Grace period expired — remove player from lobby (game forfeit handled by caller on disconnect). */
  leaveLobbyAfterDisconnectTimeout(lobbyId: string, playerId: string): boolean {
    const record = this.lobbies.get(lobbyId)
    if (!record) return false

    const player = record.players.find((p) => p.id === playerId)
    if (!player) return false

    this.clearDisconnectTimer(player)
    return this.leaveLobby(lobbyId, playerId)
  }

  markConnected(lobbyId: string, playerId: string): void {
    const record = this.lobbies.get(lobbyId)
    if (!record) return
    const player = record.players.find((p) => p.id === playerId)
    if (!player) return

    this.clearDisconnectTimer(player)
    player.connected = true
    this.emitChange(lobbyId, this.toSnapshot(record))
  }

  getLobbyIdForPlayer(playerId: string): string | undefined {
    return this.playerLobbyIndex.get(playerId)
  }

  getActiveLobbyCount(): number {
    let count = 0
    for (const lobby of this.lobbies.values()) {
      if (lobby.players.length > 0) count += 1
    }
    return count
  }

  /** Called when a game ends — return lobby to waiting state. */
  resetAfterGame(lobbyId: string): LobbySnapshot | null {
    const record = this.lobbies.get(lobbyId)
    if (!record) return null

    record.status = 'lobby'
    record.currentGameId = null
    record.countdownSeconds = null
    record.players.forEach((p) => {
      p.ready = false
    })

    const snapshot = this.toSnapshot(record)
    this.emitChange(lobbyId, snapshot)
    return snapshot
  }

  setInGame(lobbyId: string, gameId: string): void {
    const record = this.lobbies.get(lobbyId)
    if (!record) return
    record.status = 'in_game'
    record.currentGameId = gameId
    this.cancelCountdown(record, 'game_started')
  }

  private canStartCountdown(record: LobbyRecord): boolean {
    const active = record.players.filter((p) => p.connected)
    if (active.length < LOBBY_MIN_PLAYERS_TO_START) return false
    return active.every((p) => p.ready && p.color !== null)
  }

  private startCountdown(record: LobbyRecord): void {
    if (record.countdownTimer) return
    record.status = 'countdown'
    record.countdownSeconds = LOBBY_START_COUNTDOWN_SECONDS

    record.countdownTimer = setInterval(() => {
      if (record.countdownSeconds === null) return
      record.countdownSeconds -= 1

      if (record.countdownSeconds <= 0) {
        this.finishCountdown(record)
        return
      }

      this.emitChange(record.lobbyId, this.toSnapshot(record))
    }, 1000)

    this.emitChange(record.lobbyId, this.toSnapshot(record))
  }

  private finishCountdown(record: LobbyRecord): void {
    this.cancelCountdown(record, 'countdown_complete')

    const activePlayers = record.players.filter((p) => p.connected && p.color)
    const players: Player[] = activePlayers.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color!,
    }))

    const firstPlayerId = players[Math.floor(Math.random() * players.length)]?.id
    if (!firstPlayerId) return

    const gameId = randomUUID()
    record.currentGameId = gameId
    record.status = 'in_game'

    this.onGameStart?.({
      lobbyId: record.lobbyId,
      gameId,
      players,
      firstPlayerId,
    })

    this.emitChange(record.lobbyId, this.toSnapshot(record))
  }

  private cancelCountdown(record: LobbyRecord, _reason: string): void {
    if (record.countdownTimer) {
      clearInterval(record.countdownTimer)
      record.countdownTimer = null
    }
    if (record.status === 'countdown') {
      record.status = 'lobby'
    }
    record.countdownSeconds = null
  }

  private removePlayer(record: LobbyRecord, playerId: string, _reason: string): void {
    const index = record.players.findIndex((p) => p.id === playerId)
    if (index < 0) return

    const [removed] = record.players.splice(index, 1)
    this.clearDisconnectTimer(removed)
    this.playerLobbyIndex.delete(playerId)

    if (record.hostPlayerId === playerId && record.players.length > 0) {
      const nextHost = record.players.find((p) => p.connected) ?? record.players[0]
      record.hostPlayerId = nextHost.id
      record.players.forEach((p) => {
        p.isHost = p.id === nextHost.id
      })
    }

    this.cancelCountdown(record, 'player_removed')
  }

  private destroyLobby(lobbyId: string): void {
    const record = this.lobbies.get(lobbyId)
    if (!record) return
    this.cancelCountdown(record, 'destroy')
    this.joinCodeIndex.delete(record.joinCode)
    record.players.forEach((p) => {
      this.clearDisconnectTimer(p)
      this.playerLobbyIndex.delete(p.id)
    })
    this.lobbies.delete(lobbyId)
    this.onDestroy?.(lobbyId)
  }

  private clearDisconnectTimer(player: InternalLobbyPlayer): void {
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer)
      player.disconnectTimer = null
    }
  }

  private getLobbyOrThrow(lobbyId: string, playerId: string): LobbyRecord {
    const record = this.lobbies.get(lobbyId)
    if (!record) throw new Error('Lobby not found')
    if (!record.players.some((p) => p.id === playerId)) {
      throw new Error('Player not in lobby')
    }
    return record
  }

  private getPlayerOrThrow(record: LobbyRecord, playerId: string): InternalLobbyPlayer {
    const player = record.players.find((p) => p.id === playerId)
    if (!player) throw new Error('Player not found')
    return player
  }

  private toSnapshot(record: LobbyRecord): LobbySnapshot {
    const takenColors = record.players
      .map((p) => p.color)
      .filter((c): c is PlayerColor => c !== null)

    const playerCount = record.players.length

    return {
      lobbyId: record.lobbyId,
      joinCode: record.joinCode,
      status: record.status,
      settings: { ...record.settings },
      players: record.players.map(({ disconnectTimer: _t, ...p }) => p),
      takenColors,
      playerCount,
      countdownSeconds: record.countdownSeconds,
      currentGameId: record.currentGameId,
      canCountdown: this.canStartCountdown(record) && record.status === 'lobby',
    }
  }

  private emitChange(lobbyId: string, snapshot: LobbySnapshot): void {
    this.onChange?.(lobbyId, snapshot)
  }
}
