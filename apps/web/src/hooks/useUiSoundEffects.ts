import { useEffect } from 'react'
import { audioManager } from '../lib/audio/audioManager'
import { resolveUiSoundTarget } from '../lib/audio/uiSoundTargets'

function isFinePointerDevice(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches
}

function shouldSkipUiSoundTarget(target: Element): boolean {
  if (target.closest('[data-ui-sound="off"]')) return true
  if (target.matches('input[type="range"]')) return true
  return false
}

function resolveActiveHoverTarget(clientX: number, clientY: number): Element | null {
  const hit = document.elementFromPoint(clientX, clientY)
  const target = resolveUiSoundTarget(hit)
  if (!target || shouldSkipUiSoundTarget(target)) return null
  return target
}

/** Ignore brief leave/re-enter on the same control (CSS hover transforms shift hit boxes). */
const REENTER_SUPPRESS_MS = 280

export function useUiSoundEffects(): void {
  useEffect(() => {
    let unlocked = false
    let hoveredTarget: Element | null = null
    let leftTargetAt = 0
    let leftTargetEl: Element | null = null

    const unlock = () => {
      if (unlocked) return
      unlocked = true
      audioManager.unlock()
    }

    const onPointerDown = (event: PointerEvent) => {
      unlock()
      if (event.button !== 0) return

      const target = resolveUiSoundTarget(event.target)
      if (!target || shouldSkipUiSoundTarget(target)) return

      audioManager.play('ui.click')
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!isFinePointerDevice()) return
      if (event.pointerType !== 'mouse') return

      const active = resolveActiveHoverTarget(event.clientX, event.clientY)
      if (active === hoveredTarget) return

      if (active === null) {
        if (hoveredTarget) {
          leftTargetAt = performance.now()
          leftTargetEl = hoveredTarget
        }
        hoveredTarget = null
        return
      }

      if (
        active === leftTargetEl &&
        performance.now() - leftTargetAt < REENTER_SUPPRESS_MS
      ) {
        hoveredTarget = active
        return
      }

      hoveredTarget = active
      leftTargetEl = null
      audioManager.playHover()
    }

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      hoveredTarget = null
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = resolveUiSoundTarget(event.target)
      if (!target || shouldSkipUiSoundTarget(target)) return
      if (!(target instanceof HTMLElement)) return
      if (target.tagName !== 'BUTTON' && target.getAttribute('role') !== 'button') return

      unlock()
      audioManager.play('ui.click')
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true })
    document.addEventListener('pointerleave', onPointerLeave, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerleave', onPointerLeave, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])
}
