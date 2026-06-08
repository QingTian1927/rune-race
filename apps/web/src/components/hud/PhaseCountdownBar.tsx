import type { ReactNode } from 'react'

type PhaseCountdownBarProps = {
  label: string
  remainingMs: number
  totalMs: number
  suffix?: string
  children?: ReactNode
}

export function PhaseCountdownBar({
  label,
  remainingMs,
  totalMs,
  suffix,
  children,
}: PhaseCountdownBarProps) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const maxSeconds = Math.max(1, Math.ceil(totalMs / 1000))
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0

  return (
    <div className="rune-phase-countdown">
      <p className="rune-phase-countdown__label" role="status" aria-live="polite">
        {label}{' '}
        <span className="tabular-nums rune-phase-countdown__seconds">{seconds}s</span>
        {suffix ? (
          <>
            {' · '}
            {suffix}
          </>
        ) : null}
      </p>
      <div
        className="rune-phase-countdown__track"
        role="progressbar"
        aria-valuenow={seconds}
        aria-valuemin={0}
        aria-valuemax={maxSeconds}
        aria-label={label}
      >
        <div className="rune-phase-countdown__fill" style={{ width: `${progress * 100}%` }} />
      </div>
      {children}
    </div>
  )
}
