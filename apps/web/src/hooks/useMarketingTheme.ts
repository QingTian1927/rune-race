import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'runeRaceTheme'

export function useMarketingTheme() {
  const [isNight, setIsNight] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY) === 'night'
  })

  useEffect(() => {
    document.body.classList.add('marketing-active')
    document.body.classList.toggle('night', isNight)
    return () => {
      document.body.classList.remove('marketing-active', 'night')
    }
  }, [isNight])

  const toggleTheme = useCallback(() => {
    setIsNight((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? 'night' : 'day')
      return next
    })
  }, [])

  return { isNight, toggleTheme }
}
