import { useEffect, useState } from 'react'

type PresencePhase = 'enter' | 'idle' | 'exit'

type PresenceTransitionOptions = {
  enterMs?: number
  exitMs?: number
}

/** Keeps an element mounted briefly so exit animations can finish. */
export function usePresenceTransition(
  show: boolean,
  enterMsOrOptions: number | PresenceTransitionOptions = 240,
  exitMsArg?: number,
) {
  const options =
    typeof enterMsOrOptions === 'number'
      ? { enterMs: enterMsOrOptions, exitMs: exitMsArg ?? enterMsOrOptions }
      : {
          enterMs: enterMsOrOptions.enterMs ?? 240,
          exitMs: enterMsOrOptions.exitMs ?? enterMsOrOptions.enterMs ?? 240,
        }

  const { enterMs, exitMs } = options
  const [render, setRender] = useState(show)
  const [phase, setPhase] = useState<PresencePhase>(show ? 'enter' : 'exit')

  useEffect(() => {
    if (show) {
      setRender(true)
      setPhase('enter')
      const enterTimer = window.setTimeout(() => setPhase('idle'), enterMs)
      return () => window.clearTimeout(enterTimer)
    }

    if (!render) return

    setPhase('exit')
    const exitTimer = window.setTimeout(() => setRender(false), exitMs)
    return () => window.clearTimeout(exitTimer)
  }, [show, enterMs, exitMs, render])

  const motionClass =
    phase === 'enter' ? 'game-hud-presence--in' : phase === 'exit' ? 'game-hud-presence--out' : ''

  return { render, motionClass, phase }
}
