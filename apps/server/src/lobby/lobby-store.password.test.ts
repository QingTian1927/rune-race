import { describe, expect, it } from 'vitest'
import { LobbyStore } from './lobby-store'

describe('LobbyStore password', () => {
  it('lets the host re-join a password room without sending the password again', () => {
    const store = new LobbyStore()
    const created = store.createLobby({
      hostPlayerId: 'host-1',
      hostName: 'Host',
      password: 'secret',
    })

    const { snapshot } = store.joinLobby({
      lobbyId: created.lobbyId,
      playerId: 'host-1',
      playerName: 'Host',
    })

    expect(snapshot.lobbyId).toBe(created.lobbyId)
    expect(snapshot.players.some((p) => p.id === 'host-1')).toBe(true)
    expect(store.getHostRoomPassword(created.lobbyId, 'host-1')).toBe('secret')
  })

  it('rejects new players without the correct password', () => {
    const store = new LobbyStore()
    const created = store.createLobby({
      hostPlayerId: 'host-1',
      hostName: 'Host',
      password: 'secret',
    })

    expect(() =>
      store.joinLobby({
        lobbyId: created.lobbyId,
        playerId: 'guest-1',
        playerName: 'Guest',
      }),
    ).toThrow(/invalid password/i)

    const { snapshot: joined } = store.joinLobby({
      lobbyId: created.lobbyId,
      playerId: 'guest-1',
      playerName: 'Guest',
      password: 'secret',
    })

    expect(joined.players.some((p) => p.id === 'guest-1')).toBe(true)
  })

  it('clears the room password when the host requests clearPassword', () => {
    const store = new LobbyStore()
    const created = store.createLobby({
      hostPlayerId: 'host-1',
      hostName: 'Host',
      password: 'secret',
    })

    store.joinLobby({
      lobbyId: created.lobbyId,
      playerId: 'host-1',
      playerName: 'Host',
    })

    const updated = store.updateSettings(created.lobbyId, 'host-1', { clearPassword: true })
    expect(updated.settings.hasPassword).toBe(false)
    expect(store.getHostRoomPassword(created.lobbyId, 'host-1')).toBeNull()

    const { snapshot: guest } = store.joinLobby({
      lobbyId: created.lobbyId,
      playerId: 'guest-1',
      playerName: 'Guest',
    })
    expect(guest.players.some((p) => p.id === 'guest-1')).toBe(true)
  })
})
