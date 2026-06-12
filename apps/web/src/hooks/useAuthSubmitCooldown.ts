import { useCallback, useEffect, useState } from 'react'

export function useAuthSubmitCooldown(cooldownMs: number) {
  const [untilMs, setUntilMs] = useState(0)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  useEffect(() => {
    if (untilMs <= Date.now()) {
      setCooldownSeconds(0)
      return
    }

    const tick = () => {
      const leftMs = untilMs - Date.now()
      if (leftMs <= 0) {
        setCooldownSeconds(0)
        setUntilMs(0)
        return
      }
      setCooldownSeconds(Math.ceil(leftMs / 1000))
    }

    tick()
    const interval = window.setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [untilMs])

  const startCooldown = useCallback(() => {
    setUntilMs(Date.now() + cooldownMs)
  }, [cooldownMs])

  return {
    cooldownSeconds,
    isCoolingDown: cooldownSeconds > 0,
    startCooldown,
  }
}
