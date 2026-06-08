import { useEffect, useRef, useState } from 'react'

export function usePhaseCountdown(active: boolean, phaseKey: string, totalMs: number) {
  const [clock, setClock] = useState(() => Date.now())
  const startedAtRef = useRef(clock)
  const lastKeyRef = useRef('')

  if (active && phaseKey !== lastKeyRef.current) {
    lastKeyRef.current = phaseKey
    startedAtRef.current = Date.now()
  }

  useEffect(() => {
    if (!active) return
    const started = Date.now()
    startedAtRef.current = started
    setClock(started)
    const id = window.setInterval(() => setClock(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [active, phaseKey])

  if (!active) {
    return { remainingMs: totalMs, progress: 1, seconds: Math.ceil(totalMs / 1000) }
  }

  const elapsed = clock - startedAtRef.current
  const remainingMs = Math.max(0, totalMs - elapsed)
  const progress = totalMs > 0 ? remainingMs / totalMs : 0

  return {
    remainingMs,
    progress,
    seconds: Math.max(0, Math.ceil(remainingMs / 1000)),
  }
}
