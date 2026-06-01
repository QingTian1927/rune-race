import { describe, expect, it } from 'vitest'
import { LobbyStore } from './lobby-store'

describe('LobbyStore cleanupStaleLobbies', () => {
  it('destroys lobbies with no players', () => {
    const store = new LobbyStore()
    const created = store.createLobby({ hostPlayerId: 'host', hostName: 'Host' })
    store.leaveLobby(created.lobbyId, 'host')
    expect(store.getSnapshot(created.lobbyId)).toBeNull()
  })

  it('destroys waiting lobbies when nobody is connected', () => {
    const store = new LobbyStore()
    const created = store.createLobby({ hostPlayerId: 'host', hostName: 'Host' })
    expect(created.players[0]?.connected).toBe(false)

    const removed = store.cleanupStaleLobbies()
    expect(removed).toBe(1)
    expect(store.getSnapshot(created.lobbyId)).toBeNull()
  })

  it('keeps lobbies that have at least one connected player', () => {
    const store = new LobbyStore()
    const created = store.createLobby({ hostPlayerId: 'host', hostName: 'Host' })
    store.joinLobby({ lobbyId: created.lobbyId, playerId: 'host', playerName: 'Host' })

    const removed = store.cleanupStaleLobbies()
    expect(removed).toBe(0)
    expect(store.getSnapshot(created.lobbyId)).not.toBeNull()
  })
})
