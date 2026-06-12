import type { Server as HttpServer } from 'node:http'
import type { Server as SocketIOServer } from 'socket.io'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdminClient } from '../lib/supabase-server'
import type {
  AdminReadinessDependencies,
  AdminReadinessMetrics,
  AdminReadinessResponse,
  CheckStatus,
  OverallStatus,
  PublicReadinessResponse,
  ReadinessCheckResult,
} from './types'

const DB_PING_TIMEOUT_MS = 5_000
const DB_WARN_LATENCY_MS = 2_000

export type ReadinessProbeContext = {
  httpServer: HttpServer
  io: SocketIOServer
  getActiveLobbyCount: () => number
  getActiveGameCount: () => number
  getMatchmakingQueueSize: () => number
  isAnalyticsSchedulerActive: () => boolean
  corsRestricted: boolean
  startedAtMs: number
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error: unknown) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

function requiresSupabaseInProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

async function probeDatabase(supabase: SupabaseClient | null): Promise<ReadinessCheckResult> {
  // Database supports profiles/analytics but is not required to create rooms or play anonymously.
  if (!supabase) {
    if (requiresSupabaseInProduction()) {
      return {
        status: 'fail',
        critical: false,
        message: 'SUPABASE_URL or SUPABASE_SECRET_KEY is not configured',
      }
    }
    return {
      status: 'skipped',
      critical: false,
      message: 'Supabase is not configured (development)',
    }
  }

  const startedAt = Date.now()
  try {
    const { error } = await withTimeout(
      (async () => supabase.from('app_settings').select('key').limit(1))(),
      DB_PING_TIMEOUT_MS,
      'database',
    )
    const latencyMs = Date.now() - startedAt
    if (error) {
      return {
        status: 'fail',
        critical: false,
        latencyMs,
        message: error.message,
      }
    }
    if (latencyMs >= DB_WARN_LATENCY_MS) {
      return {
        status: 'warn',
        critical: false,
        latencyMs,
        message: `Database responded slowly (${latencyMs}ms)`,
      }
    }
    return { status: 'ok', critical: false, latencyMs }
  } catch (error) {
    return {
      status: 'fail',
      critical: false,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'Database probe failed',
    }
  }
}

function probeSocket(io: SocketIOServer, httpServer: HttpServer): ReadinessCheckResult {
  const startedAt = Date.now()
  const listening = Boolean(httpServer.listening)
  if (!listening) {
    return {
      status: 'fail',
      critical: true,
      message: 'HTTP server is not listening',
    }
  }
  if (!io.httpServer) {
    return {
      status: 'fail',
      critical: true,
      message: 'Socket.IO is not attached to the HTTP server',
    }
  }
  return {
    status: 'ok',
    critical: true,
    latencyMs: Date.now() - startedAt,
  }
}

function probeApi(): ReadinessCheckResult {
  return { status: 'ok', critical: true, latencyMs: 0 }
}

function probeAnalyticsScheduler(isActive: boolean, supabaseConfigured: boolean): ReadinessCheckResult {
  if (!supabaseConfigured) {
    return {
      status: 'skipped',
      critical: false,
      message: 'Analytics scheduler requires Supabase',
    }
  }
  if (!isActive) {
    return {
      status: 'warn',
      critical: false,
      message: 'Analytics rollup scheduler is not running',
    }
  }
  return { status: 'ok', critical: false, latencyMs: 0 }
}

export function aggregateOverallStatus(checks: Record<string, ReadinessCheckResult>): OverallStatus {
  const values = Object.values(checks)
  if (values.some((check) => check.critical && check.status === 'fail')) {
    return 'down'
  }
  if (values.some((check) => check.status === 'warn' || check.status === 'fail' || check.status === 'skipped')) {
    return 'degraded'
  }
  return 'ready'
}

function toPublicChecks(checks: Record<string, ReadinessCheckResult>): PublicReadinessResponse['checks'] {
  return Object.fromEntries(
    Object.entries(checks).map(([name, check]) => [name, { status: check.status }]),
  )
}

export async function buildReadinessReport(
  context: ReadinessProbeContext,
  options: { detail: 'public' | 'admin' },
): Promise<PublicReadinessResponse | AdminReadinessResponse> {
  const supabase = getSupabaseAdminClient()
  const supabaseConfigured = supabase !== null

  const checks: Record<string, ReadinessCheckResult> = {
    api: probeApi(),
    socket: probeSocket(context.io, context.httpServer),
    database: await probeDatabase(supabase),
    analytics: probeAnalyticsScheduler(context.isAnalyticsSchedulerActive(), supabaseConfigured),
  }

  const status = aggregateOverallStatus(checks)
  const timestamp = new Date().toISOString()
  const base: PublicReadinessResponse = {
    status,
    timestamp,
    checks: toPublicChecks(checks),
  }

  if (options.detail === 'public') {
    return base
  }

  const dependencies: AdminReadinessDependencies = {
    supabaseConfigured,
    analyticsSchedulerActive: context.isAnalyticsSchedulerActive(),
    corsRestricted: context.corsRestricted,
  }

  const metrics: AdminReadinessMetrics = {
    activeLobbies: context.getActiveLobbyCount(),
    activeGames: context.getActiveGameCount(),
    connectedSockets: context.io.engine.clientsCount,
    matchmakingQueueSize: context.getMatchmakingQueueSize(),
  }

  const admin: AdminReadinessResponse = {
    ...base,
    uptimeSeconds: Math.floor((Date.now() - context.startedAtMs) / 1000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    checks,
    metrics,
    dependencies,
  }

  return admin
}

export function readinessHttpStatus(status: OverallStatus): number {
  return status === 'down' ? 503 : 200
}

export function isCheckStatus(value: string): value is CheckStatus {
  return value === 'ok' || value === 'warn' || value === 'fail' || value === 'skipped'
}
