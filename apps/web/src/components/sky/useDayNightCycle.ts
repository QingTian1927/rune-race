import { useEffect } from 'react'

const DAY_DURATION = 30_000
const NIGHT_DURATION = 30_000
const DUSK_MS = 4_200
const DAWN_MS = 4_200

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

export function useDayNightCycle(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const timeouts: ReturnType<typeof setTimeout>[] = []

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms)
      timeouts.push(id)
    }

    const endNightTransition = () => {
      const stars = document.querySelector('.stars') as HTMLElement | null
      if (stars) {
        stars.style.transition = 'opacity 3s ease'
        stars.style.opacity = '0'
        schedule(() => {
          stars.innerHTML = ''
          stars.style.transition = ''
        }, 3200)
      }
      document.body.classList.add('dawn')
      document.body.classList.remove('night')
      schedule(() => {
        document.body.classList.remove('dawn')
        schedule(() => startNightTransition(), DAY_DURATION)
      }, DAWN_MS)
    }

    const startNightTransition = () => {
      document.body.classList.add('dusk')
      schedule(() => {
        createStars(80)
        document.body.classList.add('night')
        document.body.classList.remove('dusk')
        schedule(() => endNightTransition(), NIGHT_DURATION)
      }, DUSK_MS)
    }

    schedule(() => startNightTransition(), DAY_DURATION)

    return () => {
      timeouts.forEach(clearTimeout)
      document.body.classList.remove('dusk', 'night', 'dawn')
      const stars = document.querySelector('.stars')
      if (stars) stars.innerHTML = ''
    }
  }, [enabled])
}
