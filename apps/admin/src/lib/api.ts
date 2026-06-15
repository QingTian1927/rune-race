import { API_BASE } from '../config'
import type { SiteBannerAdminStatus, SiteBannerConfig } from '@rune-race/shared'

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

export type ReportUser = {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  accountCreatedAt: string | null
  lastPlayedAt: string | null
}

export type UsersReportResponse = {
  generatedAt: string
  total: number
  users: ReportUser[]
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

async function adminFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
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

export type SiteBannerFormPatch = {
  enabled: boolean
  message: string
  linkUrl: string | null
  linkLabel: string
  visibleFrom: string | null
  visibleUntil: string | null
}

export type AdminSettings = {
  accountNudgeEnabled: boolean
  accountNudgeEnvDisabled: boolean
  siteBanner: SiteBannerConfig | null
  siteBannerStatus: SiteBannerAdminStatus
}

export type ReadinessCheckStatus = 'ok' | 'warn' | 'fail' | 'skipped'

export type OverallReadinessStatus = 'ready' | 'degraded' | 'down'

export type AdminReadinessCheck = {
  status: ReadinessCheckStatus
  critical: boolean
  latencyMs?: number
  message?: string
}

export type AdminReadinessResponse = {
  status: OverallReadinessStatus
  timestamp: string
  uptimeSeconds: number
  nodeEnv: string
  checks: Record<string, AdminReadinessCheck>
  metrics: {
    activeLobbies: number
    activeGames: number
    connectedSockets: number
    matchmakingQueueSize: number
  }
  dependencies: {
    supabaseConfigured: boolean
    analyticsSchedulerActive: boolean
    corsRestricted: boolean
  }
}

export function fetchAdminSettings(accessToken: string): Promise<AdminSettings> {
  return adminFetch<AdminSettings>('/api/admin/settings', accessToken)
}

export function updateAdminSettings(
  accessToken: string,
  patch: { accountNudgeEnabled?: boolean; siteBanner?: SiteBannerFormPatch },
): Promise<AdminSettings> {
  return adminFetch<AdminSettings>('/api/admin/settings', accessToken, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
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

export function fetchUsersReport(accessToken: string): Promise<UsersReportResponse> {
  return adminFetch<UsersReportResponse>('/api/admin/users/report', accessToken)
}

/** Public readiness probe with operator detail (no auth). */
export async function fetchReadinessDetail(): Promise<AdminReadinessResponse> {
  const res = await fetch(`${API_BASE}/ready?detail=admin`, {
    headers: { Accept: 'application/json' },
  })
  const body = (await res.json().catch(() => null)) as AdminReadinessResponse | null
  if (!body || typeof body !== 'object' || !('status' in body)) {
    throw new ApiError(`HTTP ${res.status}`, res.status)
  }
  return body
}
