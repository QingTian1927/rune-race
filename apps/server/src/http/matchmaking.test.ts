import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOBBY_MAX_PLAYERS, MATCHMAKING_SOLO_BOT_SECONDS } from '@rune-race/shared'
import { BotManager } from '../bot/bot-manager'
import { ChatStore } from '../chat/chat-store'
import { GameStore } from '../game/game-store'
import { LobbyStore } from '../lobby/lobby-store'
import { MatchmakingQueue } from './matchmaking'

function createTestQueue() {
  const store = new LobbyStore()
  const gameStore = new GameStore()
  const chatStore = new ChatStore()
  const io = { to: () => ({ emit: vi.fn() }) } as never
  const botManager = new BotManager(store, gameStore, chatStore, io)
  const queue = new MatchmakingQueue(store, botManager)
  return { store, queue, botManager }
}

describe('MatchmakingQueue', () => {
  let store: LobbyStore
  let queue: MatchmakingQueue

  beforeEach(() => {
    vi.useFakeTimers()
    ;({ store, queue } = createTestQueue())
  })

  afterEach(() => {
    queue.shutdown()
    vi.useRealTimers()
  })

  it('clears stale matched status after lobby is destroyed', () => {
    queue.join('player-1', 'One')
    queue.join('player-2', 'Two')
    vi.advanceTimersByTime(4000)

    const matched = queue.getStatus('player-1')
    expect(matched.status).toBe('matched')
    expect(matched.lobbyId).toBeTruthy()

    store.cleanupStaleLobbies()

    const afterCleanup = queue.getStatus('player-1')
    expect(afterCleanup.status).toBe('idle')
  })

  it('clears matched results when player joins queue again', () => {
    queue.join('player-1', 'One')
    queue.join('player-2', 'Two')
    vi.advanceTimersByTime(4000)

    const lobbyId = queue.getStatus('player-1').lobbyId
    expect(lobbyId).toBeTruthy()

    queue.join('player-1', 'One')
    expect(queue.getStatus('player-1').status).toBe('queued')
  })

  it('matches two players after tier-2 wait and fills bots to max', () => {
    queue.join('player-1', 'One')
    queue.join('player-2', 'Two')
    vi.advanceTimersByTime(4000)

    const lobbyId = queue.getStatus('player-1').lobbyId!
    const snapshot = store.getSnapshot(lobbyId)!
    expect(snapshot.players).toHaveLength(LOBBY_MAX_PLAYERS)
    expect(snapshot.players.filter((p) => p.isBot)).toHaveLength(2)
    expect(snapshot.players.filter((p) => !p.isBot)).toHaveLength(2)
    expect(snapshot.players.filter((p) => !p.isBot).every((p) => p.color)).toBe(true)
    expect(snapshot.players.filter((p) => !p.isBot).every((p) => !p.ready)).toBe(true)
  })

  it('creates a bot-filled lobby for a solo player after solo timeout', () => {
    queue.join('solo-1', 'Solo')
    vi.advanceTimersByTime(MATCHMAKING_SOLO_BOT_SECONDS * 1000)

    const status = queue.getStatus('solo-1')
    expect(status.status).toBe('matched')

    const snapshot = store.getSnapshot(status.lobbyId!)!
    expect(snapshot.players.filter((p) => !p.isBot)).toHaveLength(1)
    expect(snapshot.players.filter((p) => p.isBot)).toHaveLength(3)
    expect(snapshot.players.find((p) => p.id === 'solo-1')?.color).toBeTruthy()
  })

  it('matches three players after tier-3 wait with one bot filler', () => {
    queue.join('player-1', 'One')
    queue.join('player-2', 'Two')
    queue.join('player-3', 'Three')
    vi.advanceTimersByTime(7000)

    const lobbyId = queue.getStatus('player-1').lobbyId!
    const snapshot = store.getSnapshot(lobbyId)!
    expect(snapshot.players.filter((p) => !p.isBot)).toHaveLength(3)
    expect(snapshot.players.filter((p) => p.isBot)).toHaveLength(1)
  })
})

describe('LobbyStore join color auto-assign', () => {
  it('assigns the last free color when a player joins and only one remains', () => {
    const store = new LobbyStore()
    const created = store.createLobby({ hostPlayerId: 'host', hostName: 'Host' })
    store.setColor(created.lobbyId, 'host', 'red')
    store.addBot(created.lobbyId, 'host', { botId: 'bot-1', botName: 'Bot 1' })
    store.setColor(created.lobbyId, 'bot-1', 'blue')
    store.addBot(created.lobbyId, 'host', { botId: 'bot-2', botName: 'Bot 2' })
    store.setColor(created.lobbyId, 'bot-2', 'green')

    const { snapshot } = store.joinLobby({
      lobbyId: created.lobbyId,
      playerId: 'guest',
      playerName: 'Guest',
    })

    const guest = snapshot.players.find((p) => p.id === 'guest')
    expect(guest?.color).toBe('yellow')
    expect(guest?.ready).toBe(false)
  })

  it('does not auto-assign when multiple colors are still free', () => {
    const store = new LobbyStore()
    const created = store.createLobby({ hostPlayerId: 'host', hostName: 'Host' })
    store.setColor(created.lobbyId, 'host', 'red')

    const { snapshot } = store.joinLobby({
      lobbyId: created.lobbyId,
      playerId: 'guest',
      playerName: 'Guest',
    })

    expect(snapshot.players.find((p) => p.id === 'guest')?.color).toBeNull()
  })
})

describe('LobbyStore bot eviction on join', () => {
  it('evicts one bot when a human joins a full bot-filled lobby', () => {
    const store = new LobbyStore()
    const created = store.createLobby({ hostPlayerId: 'host', hostName: 'Host' })
    store.addBot(created.lobbyId, 'host', { botId: 'bot-1', botName: 'Bot 1' })
    store.addBot(created.lobbyId, 'host', { botId: 'bot-2', botName: 'Bot 2' })
    store.addBot(created.lobbyId, 'host', { botId: 'bot-3', botName: 'Bot 3' })

    const { snapshot, evictedBotId } = store.joinLobby({
      lobbyId: created.lobbyId,
      playerId: 'guest',
      playerName: 'Guest',
    })

    expect(evictedBotId).toBe('bot-1')
    expect(snapshot.players).toHaveLength(4)
    expect(snapshot.players.filter((p) => p.isBot)).toHaveLength(2)
    expect(snapshot.players.some((p) => p.id === 'guest')).toBe(true)
  })
})
