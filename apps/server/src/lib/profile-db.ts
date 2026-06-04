/**
 * Maps Supabase `profiles` rows to API shape.
 * Supports legacy columns (total_played_hours, profiles.display_name) and v2 (total_played_seconds).
 */
export type ProfileRow = {
  id: string
  full_name: string | null
  /** Value from profiles.display_name (in-game name chosen by user). */
  stored_display_name: string | null
  phone: string | null
  bio: string | null
  avatar_emoji: string | null
  is_anon: boolean
  total_played_seconds: number
  total_games: number
  total_wins: number
  total_losses: number
  last_played_at: string | null
}

/** Columns present on both legacy and v2 schemas (safe to select). */
export const PROFILE_SELECT_COLUMNS =
  'id, full_name, display_name, phone, bio, avatar_emoji, is_anon, total_games, total_wins, total_losses, total_played_hours, total_played_seconds, last_played_at'

type DbProfileRow = {
  id: string
  full_name?: string | null
  phone: string | null
  bio: string | null
  avatar_emoji: string | null
  is_anon: boolean
  total_games: number | null
  total_wins: number | null
  total_losses: number | null
  total_played_hours?: number | null
  total_played_seconds?: number | null
  last_played_at?: string | null
  display_name?: string | null
}

export function playedSecondsFromRow(row: DbProfileRow | Record<string, unknown>): number {
  const r = row as DbProfileRow
  if (typeof r.total_played_seconds === 'number') return r.total_played_seconds
  if (typeof r.total_played_hours === 'number') return Math.round(r.total_played_hours * 3600)
  return 0
}

export function mapDbProfileRow(row: DbProfileRow): ProfileRow {
  return {
    id: row.id,
    full_name: typeof row.full_name === 'string' && row.full_name.trim() ? row.full_name.trim() : null,
    stored_display_name: legacyDisplayNameFromRow(row),
    phone: row.phone,
    bio: row.bio,
    avatar_emoji: row.avatar_emoji,
    is_anon: row.is_anon,
    total_played_seconds: playedSecondsFromRow(row),
    total_games: row.total_games ?? 0,
    total_wins: row.total_wins ?? 0,
    total_losses: row.total_losses ?? 0,
    last_played_at: row.last_played_at ?? null,
  }
}

export function legacyDisplayNameFromRow(row: DbProfileRow): string | null {
  const name = row.display_name
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

export function mergePlayedSeconds(a: DbProfileRow, b: DbProfileRow): number {
  return playedSecondsFromRow(a) + playedSecondsFromRow(b)
}

/** Stats patch for legacy DB (hours) or v2 (seconds). */
export function statsUpdateFromMergedSeconds(totalSeconds: number): {
  total_played_hours?: number
  total_played_seconds?: number
} {
  return {
    total_played_hours: totalSeconds / 3600,
  }
}
