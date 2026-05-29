import type { Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@rune-race/shared'

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export class PlayerSocketRegistry {
  private byPlayer = new Map<string, Set<AppSocket>>()

  track(socket: AppSocket, playerId: string): void {
    let set = this.byPlayer.get(playerId)
    if (!set) {
      set = new Set()
      this.byPlayer.set(playerId, set)
    }
    set.add(socket)
  }

  untrack(socket: AppSocket): void {
    for (const [playerId, set] of this.byPlayer) {
      if (set.delete(socket) && set.size === 0) {
        this.byPlayer.delete(playerId)
      }
    }
  }

  getSockets(playerId: string): AppSocket[] {
    return [...(this.byPlayer.get(playerId) ?? [])]
  }
}
