import { API_BASE } from '../config'

export type OverallReadinessStatus = 'ready' | 'degraded' | 'down'

export type PublicReadinessResponse = {
  status: OverallReadinessStatus
  timestamp: string
  checks: Record<string, { status: string }>
}

const READINESS_PATH = '/ready'
const FETCH_TIMEOUT_MS = 8_000

function linkAbortSignal(parent: AbortSignal | undefined, child: AbortController): () => void {
  if (!parent) return () => undefined
  if (parent.aborted) {
    child.abort()
    return () => undefined
  }
  const onAbort = () => child.abort()
  parent.addEventListener('abort', onAbort)
  return () => parent.removeEventListener('abort', onAbort)
}

function readinessUrl(): string {
  const base = API_BASE.replace(/\/$/, '')
  return base ? `${base}${READINESS_PATH}` : READINESS_PATH
}

function isOverallStatus(value: unknown): value is OverallReadinessStatus {
  return value === 'ready' || value === 'degraded' || value === 'down'
}

export async function fetchReadiness(signal?: AbortSignal): Promise<OverallReadinessStatus> {
  const timeoutController = new AbortController()
  const timer = window.setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS)
  const unlinkParent = linkAbortSignal(signal, timeoutController)

  const response = await fetch(readinessUrl(), {
    signal: timeoutController.signal,
    headers: { Accept: 'application/json' },
  }).finally(() => {
    window.clearTimeout(timer)
    unlinkParent()
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Readiness response was not JSON')
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'status' in payload &&
    isOverallStatus((payload as PublicReadinessResponse).status)
  ) {
    return (payload as PublicReadinessResponse).status
  }

  throw new Error('Readiness response missing status')
}
