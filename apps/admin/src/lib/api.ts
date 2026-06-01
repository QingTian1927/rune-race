import { API_BASE } from '../config'

export type LiveSnapshot = {
  onlineNow: number
  activeLobbies: number
  activeGames: number
  updatedAt: string
}

export type TimeseriesPoint = {
  bucket_start: string
  unique_players: number
  games_started: number
  games_finished: number
  total_play_seconds: number
}

export type TopPlayer = {
  id: string
  total_played_seconds: number
  total_games: number
  total_wins: number
  total_losses: number
  last_played_at: string | null
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function adminFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

export function fetchLive(accessToken: string): Promise<LiveSnapshot> {
  return adminFetch<LiveSnapshot>('/api/admin/analytics/live', accessToken)
}

export async function fetchTimeseries(
  accessToken: string,
  rangeHours = 24,
): Promise<TimeseriesPoint[]> {
  const to = new Date()
  const from = new Date(Date.now() - rangeHours * 60 * 60 * 1000)
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  })
  const payload = await adminFetch<{ points: TimeseriesPoint[] }>(
    `/api/admin/analytics/timeseries?${query}`,
    accessToken,
  )
  return payload.points
}

export async function fetchTopPlayers(
  accessToken: string,
  metric: 'playtime' | 'games' = 'playtime',
): Promise<TopPlayer[]> {
  const payload = await adminFetch<{ players: TopPlayer[] }>(
    `/api/admin/analytics/top-players?metric=${metric}`,
    accessToken,
  )
  return payload.players
}
