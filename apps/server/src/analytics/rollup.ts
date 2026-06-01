import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuidLike } from './event-writer'

/** Must cover a full clock hour plus late-arriving events. */
const ROLLUP_LOOKBACK_MS = 26 * 60 * 60 * 1000

type HourlyRollup = {
  bucketStart: string
  uniquePlayers: Set<string>
  gamesStarted: number
  gamesFinished: number
  totalPlaySeconds: number
}

type HourlyRow = {
  bucket_start: string
  unique_players: number
  games_started: number
  games_finished: number
  total_play_seconds: number
}

function hourBucket(iso: string): string {
  const d = new Date(iso)
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

function ensureBucket(map: Map<string, HourlyRollup>, bucketStart: string): HourlyRollup {
  const existing = map.get(bucketStart)
  if (existing) return existing
  const next: HourlyRollup = {
    bucketStart,
    uniquePlayers: new Set<string>(),
    gamesStarted: 0,
    gamesFinished: 0,
    totalPlaySeconds: 0,
  }
  map.set(bucketStart, next)
  return next
}

function mergeHourlyRow(computed: HourlyRow, existing: HourlyRow | undefined): HourlyRow {
  if (!existing) return computed
  return {
    bucket_start: computed.bucket_start,
    unique_players: Math.max(existing.unique_players, computed.unique_players),
    games_started: Math.max(existing.games_started, computed.games_started),
    games_finished: Math.max(existing.games_finished, computed.games_finished),
    total_play_seconds: Math.max(
      Number(existing.total_play_seconds),
      computed.total_play_seconds,
    ),
  }
}

export async function runAnalyticsRollup(supabase: SupabaseClient): Promise<void> {
  const since = new Date(Date.now() - ROLLUP_LOOKBACK_MS).toISOString()
  const { data, error } = await supabase
    .from('player_session_events')
    .select('occurred_at,event_type,player_id,metadata')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true })

  if (error) {
    throw new Error(`Analytics rollup read failed: ${error.message}`)
  }

  const buckets = new Map<string, HourlyRollup>()
  for (const row of data ?? []) {
    const bucket = ensureBucket(buckets, hourBucket(String(row.occurred_at)))
    const eventType = String(row.event_type)
    const playerId = typeof row.player_id === 'string' ? row.player_id : null
    if (isUuidLike(playerId)) {
      bucket.uniquePlayers.add(playerId)
    }
    if (eventType === 'game_started') bucket.gamesStarted += 1
    if (eventType === 'game_finished') bucket.gamesFinished += 1
    if (eventType === 'session_ended') {
      const metadata = (row.metadata ?? {}) as { playSeconds?: unknown }
      const seconds = typeof metadata.playSeconds === 'number' ? metadata.playSeconds : 0
      bucket.totalPlaySeconds += Math.max(0, Math.round(seconds))
    }
  }

  if (buckets.size === 0) return

  const computed: HourlyRow[] = [...buckets.values()].map((bucket) => ({
    bucket_start: bucket.bucketStart,
    unique_players: bucket.uniquePlayers.size,
    games_started: bucket.gamesStarted,
    games_finished: bucket.gamesFinished,
    total_play_seconds: bucket.totalPlaySeconds,
  }))

  const bucketStarts = computed.map((row) => row.bucket_start)
  const { data: existingRows, error: existingError } = await supabase
    .from('player_metrics_hourly')
    .select('bucket_start,unique_players,games_started,games_finished,total_play_seconds')
    .in('bucket_start', bucketStarts)

  if (existingError) {
    throw new Error(`Analytics rollup read existing failed: ${existingError.message}`)
  }

  const existingByBucket = new Map(
    (existingRows ?? []).map((row) => [String(row.bucket_start), row as HourlyRow]),
  )

  const updatedAt = new Date().toISOString()
  const records = computed.map((row) => ({
    ...mergeHourlyRow(row, existingByBucket.get(row.bucket_start)),
    updated_at: updatedAt,
  }))

  const { error: upsertError } = await supabase
    .from('player_metrics_hourly')
    .upsert(records, { onConflict: 'bucket_start' })

  if (upsertError) {
    throw new Error(`Analytics rollup write failed: ${upsertError.message}`)
  }
}
