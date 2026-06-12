import { randomUUID } from 'node:crypto'
import type { Server as SocketIOServer } from 'socket.io'
import type {
  BotProfile,
  ClientToServerEvents,
  GameEvent,
  GameState,
  LobbyPlayer,
  LobbySnapshot,
  ServerToClientEvents,
} from '@rune-race/shared'
import { BOT_PLAYER_ID_PREFIX } from '@rune-race/shared'
import {
  decideNextAction,
  getActionDelayMs,
  getAnimationPaddingMs,
  pickBotProfile,
  pickChatMessage,
  randomBotName,
  shouldChatOnTrigger,
  type BotAction,
  type BotChatTrigger,
} from '@rune-race/bot-ai'
import type { ChatStore } from '../chat/chat-store'
import type { GameStore } from '../game/game-store'
import type { LobbyStore } from '../lobby/lobby-store'

interface BotIdentity {
  botId: string
  lobbyId: string
  profile: BotProfile
}

const BOT_CHAT_COOLDOWN_MS = 8_000
const MAX_CONSECUTIVE_FAILURES = 5
const RETRY_DELAY_MS = 800

/**
 * Server-side bot orchestrator. Bots never connect via socket — they call
 * the authoritative stores directly, going through the same engine
 * validation as human commands.
 */
export class BotManager {
  private bots = new Map<string, BotIdentity>()
  private actionTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private chatTimers = new Set<ReturnType<typeof setTimeout>>()
  private lastChatAt = new Map<string, number>()
  private failureCounts = new Map<string, number>()

  constructor(
    private readonly lobbyStore: LobbyStore,
    private readonly gameStore: GameStore,
    private readonly chatStore: ChatStore,
    private readonly io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  ) {}

  /** Matchmaking / host — seat multiple bots in free slots. */
  fillBotsToLobby(lobbyId: string, hostPlayerId: string, count: number): LobbySnapshot {
    if (count <= 0) {
      const snapshot = this.lobbyStore.getSnapshot(lobbyId)
      if (!snapshot) throw new Error('Lobby not found')
      return snapshot
    }

    let snapshot: LobbySnapshot | undefined
    for (let i = 0; i < count; i += 1) {
      ;({ snapshot } = this.addBotToLobby(lobbyId, hostPlayerId))
    }
    return snapshot!
  }

  /** Host action — create a bot with random name + profile and seat it in the lobby. */
  addBotToLobby(
    lobbyId: string,
    hostPlayerId: string,
  ): { snapshot: LobbySnapshot; bot: LobbyPlayer } {
    const current = this.lobbyStore.getSnapshot(lobbyId)
    const takenNames = current?.players.map((p) => p.name) ?? []

    const botId = `${BOT_PLAYER_ID_PREFIX}${randomUUID()}`
    const botName = randomBotName(takenNames)
    const profile = pickBotProfile()

    const snapshot = this.lobbyStore.addBot(lobbyId, hostPlayerId, { botId, botName })
    this.bots.set(botId, { botId, lobbyId, profile })
    const bot = snapshot.players.find((p) => p.id === botId)!
    return { snapshot, bot }
  }

  isManagedBot(playerId: string): boolean {
    return this.bots.has(playerId)
  }

  /** Bot was kicked or otherwise left its lobby. */
  onBotRemovedFromLobby(botId: string): void {
    const identity = this.bots.get(botId)
    if (!identity) return
    this.bots.delete(botId)
    const gameId = this.gameStore.getGameIdForPlayer(botId)
    if (gameId) {
      this.clearActionTimer(gameId, botId)
      try {
        this.gameStore.removePlayer(gameId, botId)
      } catch {
        // Game may already be over.
      }
    }
  }

  /** Lobby destroyed (e.g. all humans left) — drop its bots and end any running game. */
  onLobbyDestroyed(lobbyId: string): void {
    for (const identity of [...this.bots.values()]) {
      if (identity.lobbyId !== lobbyId) continue
      this.onBotRemovedFromLobby(identity.botId)
    }
  }

  onGameStarted(gameId: string, lobbyId: string, state: GameState): void {
    const botsInGame = state.players.filter((p) => this.bots.has(p.id))
    for (const bot of botsInGame) {
      const identity = this.bots.get(bot.id)!
      this.maybeChat(lobbyId, identity, 'game_start')
    }
    this.onGameChange(gameId, state, state.events)
  }

  /** Hooked into GameStore.onChange — schedules the next bot action and chat reactions. */
  onGameChange(gameId: string, state: GameState, events: GameEvent[]): void {
    this.reactToEvents(gameId, state, events)

    if (state.status !== 'playing') return

    const padding = getAnimationPaddingMs(events)
    for (const player of state.players) {
      const identity = this.bots.get(player.id)
      if (!identity) continue
      const action = decideNextAction({ state, botPlayerId: player.id, profile: identity.profile })
      if (!action) continue
      this.scheduleAction(gameId, identity, action.type, padding)
    }
  }

  onGameFinished(gameId: string, lobbyId: string, state: GameState): void {
    for (const player of state.players) {
      const identity = this.bots.get(player.id)
      if (!identity) continue
      this.clearActionTimer(gameId, identity.botId)
      this.maybeChat(lobbyId, identity, state.winnerId === player.id ? 'bot_won' : 'bot_lost')
    }
  }

  shutdown(): void {
    for (const timer of this.actionTimers.values()) clearTimeout(timer)
    this.actionTimers.clear()
    for (const timer of this.chatTimers) clearTimeout(timer)
    this.chatTimers.clear()
    this.bots.clear()
  }

  // --- Action scheduling ---

  private actionKey(gameId: string, botId: string): string {
    return `${gameId}:${botId}`
  }

  private clearActionTimer(gameId: string, botId: string): void {
    const key = this.actionKey(gameId, botId)
    const timer = this.actionTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.actionTimers.delete(key)
    }
    this.failureCounts.delete(key)
  }

  private scheduleAction(
    gameId: string,
    identity: BotIdentity,
    actionType: BotAction['type'],
    paddingMs: number,
    delayOverrideMs?: number,
  ): void {
    const key = this.actionKey(gameId, identity.botId)
    if (this.actionTimers.has(key)) return

    const delay = delayOverrideMs ?? getActionDelayMs(identity.profile, actionType) + paddingMs
    const timer = setTimeout(() => {
      this.actionTimers.delete(key)
      this.runNextAction(gameId, identity)
    }, delay)
    this.actionTimers.set(key, timer)
  }

  private runNextAction(gameId: string, identity: BotIdentity): void {
    if (!this.bots.has(identity.botId)) return
    const state = this.gameStore.getState(gameId)
    if (!state || state.status !== 'playing') return

    // Re-decide at execution time — the state may have moved on since scheduling.
    const action = decideNextAction({ state, botPlayerId: identity.botId, profile: identity.profile })
    if (!action) return

    const key = this.actionKey(gameId, identity.botId)
    try {
      this.executeAction(gameId, identity.botId, action)
      this.failureCounts.delete(key)
    } catch {
      // Command rejected (e.g. cell taken meanwhile) — retry with a fresh decision.
      const failures = (this.failureCounts.get(key) ?? 0) + 1
      this.failureCounts.set(key, failures)
      if (failures < MAX_CONSECUTIVE_FAILURES) {
        this.scheduleAction(gameId, identity, action.type, 0, RETRY_DELAY_MS)
      }
    }
  }

  private executeAction(gameId: string, botId: string, action: BotAction): void {
    switch (action.type) {
      case 'roll':
        this.gameStore.roll(gameId, botId)
        break
      case 'choose_move':
        this.gameStore.chooseMove(gameId, botId, action.moveId)
        break
      case 'choose_swap':
        this.gameStore.chooseSwap(gameId, botId, action.targetTokenId)
        break
      case 'draw_cards':
        this.gameStore.drawCards(gameId, botId, 1)
        break
      case 'confirm_draw':
        this.gameStore.confirmDraw(gameId, botId)
        break
      case 'finish_draw':
        this.gameStore.finishDraw(gameId, botId)
        break
      case 'place_marker':
        this.gameStore.placeMarker(
          gameId,
          botId,
          action.heldCardId,
          action.cellId,
          action.displayedIdentityId,
        )
        break
      case 'confirm_placement_ready':
        this.gameStore.confirmPlacementReady(gameId, botId)
        break
      case 'use_leave_stable':
        this.gameStore.useLeaveStable(gameId, botId, action.heldCardId)
        break
      case 'select_honesty_reward':
        this.gameStore.selectHonestyReward(gameId, botId, action.cardType)
        break
    }
  }

  // --- Chat reactions ---

  private reactToEvents(gameId: string, state: GameState, events: GameEvent[]): void {
    const lobbyId = this.gameStore.getLobbyId(gameId)
    if (!lobbyId) return

    for (const event of events) {
      const triggers = this.triggersForEvent(state, event)
      for (const { botId, trigger } of triggers) {
        const identity = this.bots.get(botId)
        if (!identity) continue
        this.maybeChat(lobbyId, identity, trigger)
      }
    }
  }

  private triggersForEvent(
    state: GameState,
    event: GameEvent,
  ): Array<{ botId: string; trigger: BotChatTrigger }> {
    const result: Array<{ botId: string; trigger: BotChatTrigger }> = []
    const isBot = (id: string) => this.bots.has(id)

    switch (event.type) {
      case 'dice_roll': {
        if (isBot(event.playerId) && event.details.result === 6) {
          result.push({ botId: event.playerId, trigger: 'bot_rolled_six' })
        }
        break
      }
      case 'token_captured': {
        const capturedTokenId = String(event.details.capturedTokenId ?? '')
        const victimId = capturedTokenId.slice(0, capturedTokenId.lastIndexOf(':'))
        if (isBot(event.playerId)) {
          result.push({ botId: event.playerId, trigger: 'bot_captured_enemy' })
        }
        if (victimId && victimId !== event.playerId && isBot(victimId)) {
          result.push({ botId: victimId, trigger: 'bot_was_captured' })
        }
        break
      }
      case 'token_finished': {
        if (isBot(event.playerId)) {
          result.push({ botId: event.playerId, trigger: 'bot_token_finished' })
        } else {
          // One random bot may comment on an opponent finishing.
          const botsInGame = state.players.filter((p) => isBot(p.id) && p.id !== event.playerId)
          const witness = botsInGame[Math.floor(Math.random() * botsInGame.length)]
          if (witness) result.push({ botId: witness.id, trigger: 'enemy_token_finished' })
        }
        break
      }
      case 'leave_stable_used': {
        if (isBot(event.playerId) && event.details.outcome === 'spawned') {
          result.push({ botId: event.playerId, trigger: 'bot_spawned' })
        }
        break
      }
      case 'marker_triggered': {
        const cardType = String(event.details.cardType ?? '')
        const isTrapCard = ['BACK_3', 'BACK_4', 'BACK_5', 'FREEZE', 'SEND_HOME'].includes(cardType)
        if (isTrapCard && isBot(event.playerId)) {
          result.push({ botId: event.playerId, trigger: 'bot_hit_trap' })
        }
        break
      }
      default:
        break
    }

    return result
  }

  private maybeChat(lobbyId: string, identity: BotIdentity, trigger: BotChatTrigger): void {
    if (!shouldChatOnTrigger(trigger, identity.profile)) return

    const now = Date.now()
    const lastAt = this.lastChatAt.get(identity.botId) ?? 0
    if (now - lastAt < BOT_CHAT_COOLDOWN_MS) return
    this.lastChatAt.set(identity.botId, now)

    const text = pickChatMessage(trigger, identity.profile)
    const delay = 700 + Math.random() * 2_000

    const timer = setTimeout(() => {
      this.chatTimers.delete(timer)
      if (!this.bots.has(identity.botId)) return
      try {
        const message = this.chatStore.send({
          lobbyId,
          playerId: identity.botId,
          text,
          lobbyStore: this.lobbyStore,
        })
        this.io.to(`lobby:${lobbyId}`).emit('chat:message', message)
      } catch {
        // Rate limited or lobby gone — drop the message.
      }
    }, delay)
    this.chatTimers.add(timer)
  }
}
