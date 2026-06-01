import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LobbyStore } from '../lobby/lobby-store'
import { MatchmakingQueue } from './matchmaking'

describe('MatchmakingQueue', () => {
  let store: LobbyStore
  let queue: MatchmakingQueue

  beforeEach(() => {
    vi.useFakeTimers()
    store = new LobbyStore()
    queue = new MatchmakingQueue(store)
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
})
