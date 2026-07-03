import { useEffect, useRef, useState } from 'react'

export type FlashDirection = 'up' | 'down' | null

/** Brief up/down flash when a numeric value changes (skips first render). */
export function useValueFlash(value: number): FlashDirection {
  const prev = useRef(value)
  const isFirst = useRef(true)
  const [flash, setFlash] = useState<FlashDirection>(null)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      prev.current = value
      return
    }

    if (value === prev.current) return

    setFlash(value > prev.current ? 'up' : 'down')
    prev.current = value

    const timer = window.setTimeout(() => setFlash(null), 720)
    return () => window.clearTimeout(timer)
  }, [value])

  return flash
}

/** Like useValueFlash but lower rank number = positive movement. */
export function useRankFlash(rank: number): FlashDirection {
  const prev = useRef(rank)
  const isFirst = useRef(true)
  const [flash, setFlash] = useState<FlashDirection>(null)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      prev.current = rank
      return
    }

    if (rank === prev.current) return

    setFlash(rank < prev.current ? 'up' : 'down')
    prev.current = rank

    const timer = window.setTimeout(() => setFlash(null), 720)
    return () => window.clearTimeout(timer)
  }, [rank])

  return flash
}
