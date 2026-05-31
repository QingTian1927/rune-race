import { useLayoutEffect, useRef } from 'react'

export function useLobbyBackButton(active: boolean) {
  const backRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const backBtn = backRef.current
    if (!backBtn) return

    if (!active) {
      backBtn.style.display = 'none'
      return
    }

    backBtn.style.display = 'inline-flex'
    const chip = document.querySelector('.game-header .player-chip')
    const page = document.querySelector('.page')
    if (chip && page) {
      const chipRect = chip.getBoundingClientRect()
      const pageRect = page.getBoundingClientRect()
      const desiredLeft = Math.round(chipRect.left - pageRect.left - 300)
      const top = Math.round(
        chipRect.top - pageRect.top + chipRect.height / 2 - backBtn.offsetHeight / 2,
      )
      backBtn.style.left = `${Math.max(4, desiredLeft)}px`
      backBtn.style.top = `${Math.max(4, top)}px`
    } else if (page) {
      backBtn.style.left = '16px'
      backBtn.style.top = `${Math.max(8, Math.round(page.getBoundingClientRect().top + 16))}px`
    }
  }, [active])

  return backRef
}
