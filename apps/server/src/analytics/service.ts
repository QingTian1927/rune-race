import type { GameState } from '@rune-race/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureProfileRow } from '../lib/ensure-profile'
import { AnalyticsEventWriter, isUuidLike } from './event-writer'
import { LiveCounters } from './live-counters'
import { runAnalyticsRollup } from './rollup'

type PlayerSession = {
  startedAtMs: number
  lastLobbyId: string | null
}

export type AnalyticsServiceOptions = {
  supabase: SupabaseClient | null
  rollupIntervalMs?: number
  logger?: { error: (msg: string, err?: unknown) => void }
}

function isProfileStatsApplied(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.profile_stats_applied === true
}

export class AnalyticsService {
  private readonly supabase: SupabaseClient | null
  private readonly eventWriter: AnalyticsEventWriter
  private readonly liveCounters: LiveCounters
  private readonly activeSessions = new Map<string, PlayerSession>()
  private readonly logger: { error: (msg: string, err?: unknown) => void }
  private rollupTimer: ReturnType<typeof setInterval> | null = null
  private readonly rollupIntervalMs: number

  constructor(options: AnalyticsServiceOptions) {
    this.supabase = options.supabase
    this.eventWriter = new AnalyticsEventWriter(options.supabase)
    this.liveCounters = new LiveCounters(options.supabase)
    this.logger = options.logger ?? { error: () => undefined }
    this.rollupIntervalMs = options.rollupIntervalMs ?? 60_000
  }

  start(): void {
    if (this.rollupTimer) return
    this.rollupTimer = setInterval(() => {
      void this.runRollupSafe()
    }, this.rollupIntervalMs)
  }

  stop(): void {
    if (!this.rollupTimer) return
    clearInterval(this.rollupTimer)
    this.rollupTimer = null
  }

  isSchedulerActive(): boolean {
    return this.rollupTimer !== null
  }

  onPresenceConnected(playerId: string, lobbyId: string): void {
    this.liveCounters.markSocketConnected(playerId)
    if (!this.activeSessions.has(playerId)) {
      this.activeSessions.set(playerId, { startedAtMs: Date.now(), lastLobbyId: lobbyId })
      void this.writeEventSafe({
        type: 'session_started',
        playerId,
        lobbyId,
      })
    } else {
      const session = this.activeSessions.get(playerId)
      if (session) session.lastLobbyId = lobbyId
    }
    void this.writeEventSafe({ type: 'presence_connected', playerId, lobbyId })
  }

  onLobbyJoined(playerId: string, lobbyId: string): void {
    void this.writeEventSafe({ type: 'lobby_joined', playerId, lobbyId })
  }

  onLobbyLeft(playerId: string, lobbyId: string, reason: string): void {
    void this.writeEventSafe({ type: 'lobby_left', playerId, lobbyId, metadata: { reason } })
    void this.endSession(playerId, lobbyId, reason)
  }

  onPresenceDisconnected(playerId: string, lobbyId: string, reason: string): void {
    this.liveCounters.markSocketDisconnected(playerId)
    void this.writeEventSafe({
      type: 'presence_disconnected',
      playerId,
      lobbyId,
      metadata: { reason },
    })
  }

  onGameStarted(gameId: string, lobbyId: string, playerIds: string[]): void {
    void this.writeEventSafe({
      type: 'game_started',
      gameId,
      lobbyId,
      metadata: { playerCount: playerIds.length, playerIds },
    })
  }

  onGameForfeit(gameId: string, lobbyId: string, playerId: string): void {
    if (!isUuidLike(gameId)) return
    void this.writeEventSafe({
      type: 'game_forfeit',
      gameId,
      lobbyId,
      playerId,
    })
  }

  onGameFinished(gameId: string, lobbyId: string, state: GameState): void {
    void this.writeEventSafe({
      type: 'game_finished',
      gameId,
      lobbyId,
      metadata: {
        winnerId: state.winnerId ?? null,
        playerIds: state.players.map((p) => p.id),
        finishedAt: Date.now(),
      },
    })
    void this.applyGameResultToProfiles(state)
  }

  async syncCounters(activeLobbies: number, activeGames: number): Promise<void> {
    this.liveCounters.setActiveLobbies(activeLobbies)
    this.liveCounters.setActiveGames(activeGames)
    await this.flushLiveCountersSafe()
  }

  getLiveSnapshot() {
    return this.liveCounters.snapshot()
  }

  private async endSession(playerId: string, lobbyId: string, reason: string): Promise<void> {
    const session = this.activeSessions.get(playerId)
    if (!session) return
    this.activeSessions.delete(playerId)
    const durationSeconds = Math.max(1, Math.round((Date.now() - session.startedAtMs) / 1000))

    await this.writeEventSafe({
      type: 'session_ended',
      playerId,
      lobbyId: session.lastLobbyId ?? lobbyId,
      metadata: {
        reason,
        playSeconds: durationSeconds,
      },
    })
  }

  private async writeEventSafe(input: Parameters<AnalyticsEventWriter['write']>[0]): Promise<void> {
    try {
      await this.eventWriter.write(input)
    } catch (error) {
      this.logger.error('analytics_event_write_failed', error)
    }
  }

  private async flushLiveCountersSafe(): Promise<void> {
    try {
      await this.liveCounters.flush()
    } catch (error) {
      this.logger.error('analytics_live_counter_flush_failed', error)
    }
  }

  private async runRollupSafe(): Promise<void> {
    const supabase = this.supabase
    if (!supabase) return
    try {
      await runAnalyticsRollup(supabase)
      await this.applyProfileStatsFromRecentSessions(supabase)
    } catch (error) {
      this.logger.error('analytics_rollup_failed', error)
    }
  }

  private async applyProfileStatsFromRecentSessions(supabase: SupabaseClient): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('player_session_events')
      .select('id,player_id,metadata,occurred_at')
      .eq('event_type', 'session_ended')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: true })

    if (error) {
      this.logger.error('analytics_profile_stats_read_failed', error)
      return
    }

    const pendingRows = (data ?? []).filter(
      (row) => !isProfileStatsApplied((row.metadata ?? {}) as Record<string, unknown>),
    )
    if (pendingRows.length === 0) return

    const totals = new Map<string, { seconds: number; lastPlayedAt: string; eventIds: string[] }>()
    for (const row of pendingRows) {
      const playerId = typeof row.player_id === 'string' ? row.player_id : null
      const eventId = typeof row.id === 'string' ? row.id : null
      if (!isUuidLike(playerId) || !eventId) continue

      const metadata = (row.metadata ?? {}) as { playSeconds?: unknown }
      const playSeconds = typeof metadata.playSeconds === 'number' ? metadata.playSeconds : 0
      const prev = totals.get(playerId) ?? { seconds: 0, lastPlayedAt: String(row.occurred_at), eventIds: [] }
      prev.seconds += Math.max(0, Math.round(playSeconds))
      prev.lastPlayedAt = String(row.occurred_at)
      prev.eventIds.push(eventId)
      totals.set(playerId, prev)
    }

    for (const [playerId, stats] of totals) {
      if (!(await ensureProfileRow(supabase, playerId))) continue

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('total_played_seconds')
        .eq('id', playerId)
        .single()
      if (profileError || !profile) continue

      const nextSeconds = (profile.total_played_seconds ?? 0) + stats.seconds
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          total_played_seconds: nextSeconds,
          last_played_at: stats.lastPlayedAt,
        })
        .eq('id', playerId)

      if (updateError) {
        this.logger.error('analytics_profile_stats_update_failed', updateError)
        continue
      }

      for (const eventId of stats.eventIds) {
        const row = pendingRows.find((r) => r.id === eventId)
        const metadata = { ...((row?.metadata ?? {}) as Record<string, unknown>), profile_stats_applied: true }
        const { error: markError } = await supabase
          .from('player_session_events')
          .update({ metadata })
          .eq('id', eventId)
        if (markError) {
          this.logger.error('analytics_profile_stats_mark_failed', markError)
        }
      }
    }
  }

  private async applyGameResultToProfiles(state: GameState): Promise<void> {
    if (!this.supabase) return
    const hasWinner = isUuidLike(state.winnerId)
    for (const player of state.players) {
      if (!isUuidLike(player.id)) continue
      if (!(await ensureProfileRow(this.supabase, player.id))) continue

      const { data: profile, error } = await this.supabase
        .from('profiles')
        .select('total_games,total_wins,total_losses,last_played_at')
        .eq('id', player.id)
        .single()
      if (error || !profile) continue

      const won = hasWinner && state.winnerId === player.id
      const patch: {
        total_games: number
        total_wins: number
        total_losses: number
        last_played_at: string
      } = {
        total_games: (profile.total_games ?? 0) + 1,
        total_wins: profile.total_wins ?? 0,
        total_losses: profile.total_losses ?? 0,
        last_played_at: new Date().toISOString(),
      }
      if (hasWinner) {
        patch.total_wins += won ? 1 : 0
        patch.total_losses += won ? 0 : 1
      }

      await this.supabase.from('profiles').update(patch).eq('id', player.id)
    }
  }
}
