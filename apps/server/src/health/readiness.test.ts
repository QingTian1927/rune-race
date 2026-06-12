import { describe, expect, it } from 'vitest'
import { aggregateOverallStatus } from './readiness'
import type { ReadinessCheckResult } from './types'

describe('aggregateOverallStatus', () => {
  it('returns ready when all checks are ok', () => {
    const checks: Record<string, ReadinessCheckResult> = {
      api: { status: 'ok', critical: true },
      socket: { status: 'ok', critical: true },
      database: { status: 'ok', critical: true },
    }
    expect(aggregateOverallStatus(checks)).toBe('ready')
  })

  it('returns down when a critical check fails', () => {
    const checks: Record<string, ReadinessCheckResult> = {
      api: { status: 'ok', critical: true },
      socket: { status: 'fail', critical: true },
      database: { status: 'ok', critical: true },
    }
    expect(aggregateOverallStatus(checks)).toBe('down')
  })

  it('returns degraded when a non-critical check warns', () => {
    const checks: Record<string, ReadinessCheckResult> = {
      api: { status: 'ok', critical: true },
      socket: { status: 'ok', critical: true },
      database: { status: 'ok', critical: true },
      analytics: { status: 'warn', critical: false },
    }
    expect(aggregateOverallStatus(checks)).toBe('degraded')
  })

  it('returns degraded when database is skipped in development', () => {
    const checks: Record<string, ReadinessCheckResult> = {
      api: { status: 'ok', critical: true },
      socket: { status: 'ok', critical: true },
      database: { status: 'skipped', critical: false },
    }
    expect(aggregateOverallStatus(checks)).toBe('degraded')
  })

  it('returns degraded when database fails but core play path is up', () => {
    const checks: Record<string, ReadinessCheckResult> = {
      api: { status: 'ok', critical: true },
      socket: { status: 'ok', critical: true },
      database: { status: 'fail', critical: false, message: 'database timed out after 5000ms' },
    }
    expect(aggregateOverallStatus(checks)).toBe('degraded')
  })
})
