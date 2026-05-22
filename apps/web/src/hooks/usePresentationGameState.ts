import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent, GameState } from '@rune-race/shared'
import {
  createGatedDisplayState,
  DICE_ANIMATION_TOTAL_MS,
  extractDiceResultFromEvents,
  hasDiceRollInDelta,
} from '../lib/dicePresentation'

type ApplyOptions = {
  /** Delta events for this snapshot (socket). Omit for local single-step updates. */
  deltaEvents?: GameEvent[]
}

/**
 * Gates gameplay visuals until the dice roll animation finishes.
 */
export function usePresentationGameState(initialState: GameState | null = null) {
  const [displayState, setDisplayState] = useState<GameState | null>(initialState)
  const [isPresentingDice, setIsPresentingDice] = useState(false)
  const [rollTrigger, setRollTrigger] = useState(0)
  const pendingStateRef = useRef<GameState | null>(null)
  const diceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const lastRollSignalRef = useRef<string | null>(null)
  const isPresentingRef = useRef(false)
  const lastVersionRef = useRef<number | null>(initialState?.version ?? null)

  const clearDiceTimer = useCallback(() => {
    if (diceTimerRef.current) {
      window.clearTimeout(diceTimerRef.current)
      diceTimerRef.current = null
    }
  }, [])

  const flushPending = useCallback(() => {
    const pending = pendingStateRef.current
    if (pending) {
      setDisplayState(pending)
      pendingStateRef.current = null
    }
    isPresentingRef.current = false
    setIsPresentingDice(false)
  }, [])

  const scheduleDiceRevealEnd = useCallback(() => {
    clearDiceTimer()
    diceTimerRef.current = window.setTimeout(() => {
      flushPending()
      diceTimerRef.current = null
    }, DICE_ANIMATION_TOTAL_MS)
  }, [clearDiceTimer, flushPending])

  const applyAuthoritativeState = useCallback(
    (incoming: GameState, options?: ApplyOptions) => {
      const delta = options?.deltaEvents ?? []
      const prevVersion = lastVersionRef.current
      const versionAdvanced = prevVersion !== null && incoming.version > prevVersion
      lastVersionRef.current = incoming.version

      if (prevVersion === null) {
        clearDiceTimer()
        pendingStateRef.current = null
        isPresentingRef.current = false
        setIsPresentingDice(false)
        setDisplayState(incoming)
        return
      }

      const diceResult = extractDiceResultFromEvents(delta) ?? incoming.turn.diceResult
      const rollEvent = delta.find((e) => e.type === 'dice_roll')

      if (rollEvent && diceResult !== null) {
        const signal = `${rollEvent.timestamp}:${diceResult}`
        if (signal !== lastRollSignalRef.current) {
          lastRollSignalRef.current = signal
          setRollTrigger((n) => n + 1)
        }
      }

      if (versionAdvanced && hasDiceRollInDelta(delta)) {
        pendingStateRef.current = incoming
        isPresentingRef.current = true
        setIsPresentingDice(true)
        setDisplayState((prev) =>
          prev ? createGatedDisplayState(prev, incoming) : incoming,
        )
        scheduleDiceRevealEnd()
        return
      }

      if (isPresentingRef.current) {
        pendingStateRef.current = incoming
        return
      }

      clearDiceTimer()
      pendingStateRef.current = null
      setDisplayState(incoming)
    },
    [clearDiceTimer, scheduleDiceRevealEnd],
  )

  useEffect(() => () => clearDiceTimer(), [clearDiceTimer])

  return {
    displayState,
    isPresentingDice,
    rollTrigger,
    applyAuthoritativeState,
    setRollTrigger,
  }
}
