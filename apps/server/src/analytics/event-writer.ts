import type { SupabaseClient } from '@supabase/supabase-js'

export type AnalyticsEventType =
  | 'presence_connected'
  | 'presence_disconnected'
  | 'lobby_joined'
  | 'lobby_left'
  | 'game_started'
  | 'game_finished'
  | 'game_forfeit'
  | 'session_started'
  | 'session_ended'

export type AnalyticsEventInput = {
  type: AnalyticsEventType
  occurredAt?: Date
  playerId?: string | null
  lobbyId?: string | null
  gameId?: string | null
  metadata?: Record<string, unknown>
}

const UUID_V4_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidLike(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_V4_LIKE.test(value)
}

export class AnalyticsEventWriter {
  constructor(private readonly supabase: SupabaseClient | null) {}

  async write(event: AnalyticsEventInput): Promise<void> {
    if (!this.supabase) return
    const payload = {
      occurred_at: (event.occurredAt ?? new Date()).toISOString(),
      event_type: event.type,
      player_id: isUuidLike(event.playerId) ? event.playerId : null,
      lobby_id: isUuidLike(event.lobbyId) ? event.lobbyId : null,
      game_id: isUuidLike(event.gameId) ? event.gameId : null,
      metadata: event.metadata ?? {},
    }
    const { error } = await this.supabase.from('player_session_events').insert(payload)
    if (error) {
      throw new Error(`Analytics event write failed: ${error.message}`)
    }
  }
}
