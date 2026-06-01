import type { SupabaseClient } from '@supabase/supabase-js'

export type LiveCountersSnapshot = {
  onlineNow: number
  activeLobbies: number
  activeGames: number
  updatedAt: string
}

export class LiveCounters {
  /** Open socket count per player (supports multiple tabs). */
  private socketCounts = new Map<string, number>()
  private activeLobbies = 0
  private activeGames = 0

  constructor(private readonly supabase: SupabaseClient | null) {}

  markSocketConnected(playerId: string): void {
    const next = (this.socketCounts.get(playerId) ?? 0) + 1
    this.socketCounts.set(playerId, next)
  }

  markSocketDisconnected(playerId: string): void {
    const current = this.socketCounts.get(playerId) ?? 0
    if (current <= 1) {
      this.socketCounts.delete(playerId)
      return
    }
    this.socketCounts.set(playerId, current - 1)
  }

  setActiveLobbies(count: number): void {
    this.activeLobbies = Math.max(0, count)
  }

  setActiveGames(count: number): void {
    this.activeGames = Math.max(0, count)
  }

  snapshot(now: Date = new Date()): LiveCountersSnapshot {
    return {
      onlineNow: this.socketCounts.size,
      activeLobbies: this.activeLobbies,
      activeGames: this.activeGames,
      updatedAt: now.toISOString(),
    }
  }

  async flush(now: Date = new Date()): Promise<void> {
    if (!this.supabase) return
    const snap = this.snapshot(now)
    const { error } = await this.supabase.from('analytics_live_counters').upsert(
      {
        id: true,
        online_now: snap.onlineNow,
        active_lobbies: snap.activeLobbies,
        active_games: snap.activeGames,
        updated_at: snap.updatedAt,
      },
      { onConflict: 'id' },
    )
    if (error) {
      throw new Error(`Live counters flush failed: ${error.message}`)
    }
  }
}
