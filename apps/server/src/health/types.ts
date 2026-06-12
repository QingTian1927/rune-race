export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skipped'

export type OverallStatus = 'ready' | 'degraded' | 'down'

export type ReadinessCheckResult = {
  status: CheckStatus
  critical: boolean
  latencyMs?: number
  message?: string
}

export type PublicCheckSummary = {
  status: CheckStatus
}

export type PublicReadinessResponse = {
  status: OverallStatus
  timestamp: string
  checks: Record<string, PublicCheckSummary>
}

export type AdminReadinessMetrics = {
  activeLobbies: number
  activeGames: number
  connectedSockets: number
  matchmakingQueueSize: number
}

export type AdminReadinessDependencies = {
  supabaseConfigured: boolean
  analyticsSchedulerActive: boolean
  corsRestricted: boolean
}

export type AdminReadinessResponse = PublicReadinessResponse & {
  uptimeSeconds: number
  nodeEnv: string
  checks: Record<string, ReadinessCheckResult>
  metrics: AdminReadinessMetrics
  dependencies: AdminReadinessDependencies
}
