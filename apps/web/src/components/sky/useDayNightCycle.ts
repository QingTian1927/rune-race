import { useEffect } from 'react'

const DAY_DURATION = 30_000
const NIGHT_DURATION = 30_000
const DUSK_MS = 4_200
const DAWN_MS = 4_200

const SKY_PHASES = ['sky-phase-day', 'sky-phase-dusk', 'sky-phase-night', 'sky-phase-dawn'] as const
type SkyPhase = (typeof SKY_PHASES)[number]

function applySkyTiming() {
  const ms = `${DUSK_MS}ms`
  document.documentElement.style.setProperty('--sky-transition-ms', ms)
}

function setSkyPhase(phase: SkyPhase) {
  document.body.classList.remove(...SKY_PHASES)
  document.body.classList.add(phase)
}

function createStars(count: number) {
  const container = document.querySelector('.stars')
  if (!container) return
  container.innerHTML = ''
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div')
    star.className = 'star'
    const size = Math.random() * 2 + 1
    star.style.width = `${size}px`
    star.style.height = `${size}px`
    star.style.left = `${Math.round(Math.random() * 100)}%`
    star.style.top = `${Math.round(Math.random() * 70)}%`
    star.style.animationDelay = `${Math.random() * 3}s`
    container.appendChild(star)
  }
}

function clearStars() {
  const stars = document.querySelector('.stars')
  if (stars) stars.innerHTML = ''
}

export function useDayNightCycle(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    applySkyTiming()
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms)
      timeouts.push(id)
    }

    const endNightTransition = () => {
      setSkyPhase('sky-phase-dawn')
      schedule(() => {
        clearStars()
        setSkyPhase('sky-phase-day')
        schedule(() => startNightTransition(), DAY_DURATION)
      }, DAWN_MS)
    }

    const startNightTransition = () => {
      setSkyPhase('sky-phase-dusk')
      createStars(80)
      schedule(() => {
        setSkyPhase('sky-phase-night')
        schedule(() => endNightTransition(), NIGHT_DURATION)
      }, DUSK_MS)
    }

    setSkyPhase('sky-phase-day')
    schedule(() => startNightTransition(), DAY_DURATION)

    return () => {
      timeouts.forEach(clearTimeout)
      document.body.classList.remove(...SKY_PHASES)
      clearStars()
    }
  }, [enabled])
}
