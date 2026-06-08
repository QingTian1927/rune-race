import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

const LONG_PRESS_MS = 450

type HandCardPressHandlers = {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => void
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
}

export function useHandCardPress(
  onSelect: () => void,
  onPreview: () => void,
  disabled: boolean,
): HandCardPressHandlers {
  const longPressTriggeredRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => clearTimer(), [clearTimer])

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled || event.button !== 0) return
      longPressTriggeredRef.current = false
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true
        onPreview()
      }, LONG_PRESS_MS)
    },
    [clearTimer, disabled, onPreview],
  )

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      clearTimer()
      if (disabled || longPressTriggeredRef.current || event.button !== 0) return
      onSelect()
    },
    [clearTimer, disabled, onSelect],
  )

  const onPointerCancel = useCallback(() => {
    clearTimer()
    longPressTriggeredRef.current = false
  }, [clearTimer])

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return
      event.preventDefault()
      clearTimer()
      longPressTriggeredRef.current = true
      onPreview()
    },
    [clearTimer, disabled, onPreview],
  )

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave: onPointerCancel,
    onContextMenu,
  }
}
