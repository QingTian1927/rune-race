import { useCallback, useEffect, useState } from 'react'
import { fetchReadiness, type OverallReadinessStatus } from '../lib/readiness'

export type ReadinessUiStatus = 'checking' | OverallReadinessStatus

const REFRESH_INTERVAL_MS = 60_000

export function useSystemReadiness() {
  const [status, setStatus] = useState<ReadinessUiStatus>('checking')

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await fetchReadiness(signal)
      setStatus(next)
    } catch {
      if (!signal?.aborted) {
        setStatus('down')
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)

    const interval = window.setInterval(() => {
      void refresh()
    }, REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [refresh])

  return { status, refresh }
}
