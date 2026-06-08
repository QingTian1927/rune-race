import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { GameState, RuneCardType } from '@rune-race/shared'
import { isBoardMarkerCardType } from '@rune-race/shared'
import { getDeltaEventsSinceVersion, updateVersionCursor } from '../lib/tokenMotion'
import type { MockPathStep } from '../mock/mockGameEngine'
import { cellIdsForPathSteps, resolveLandedCellIds } from '../lib/trackCellId'

/** How long each stacked card stays readable before fading out. */
export const RUNE_TRIGGER_FLASH_HOLD_MS = 2800
export const RUNE_TRIGGER_FLASH_EXIT_MS = 480
export const RUNE_TRIGGER_FLASH_MAX_STACK = 5

export type RuneTriggerFlashItem = {
  key: string
  cardType: RuneCardType
  exiting?: boolean
}

type PendingTrigger = {
  markerId: string
  cellId: number
  cardType: RuneCardType
  tokenId: string | null
}

type RuneTriggerFlashContextValue = {
  flashStack: RuneTriggerFlashItem[]
  notifyMarkerVisualTrigger: (
    tokenId: string,
    playerSlot: number,
    step: MockPathStep,
    worldX?: number,
    worldZ?: number,
  ) => void
  notifyTeleportBurstSkippedMarkers: (
    tokenId: string,
    playerSlot: number,
    remainingPathSteps: MockPathStep[],
  ) => void
}

const RuneTriggerFlashContext = createContext<RuneTriggerFlashContextValue | null>(null)

function findMoveTokenIdForTrigger(
  deltaEvents: GameState['events'],
  triggeredPlayerId: string,
): string | null {
  for (const event of deltaEvents) {
    if (event.type !== 'token_moved') continue
    if (event.playerId !== triggeredPlayerId) continue
    const tokenId = event.details?.tokenId
    if (typeof tokenId === 'string') return tokenId
  }
  return null
}

export function RuneTriggerFlashProvider({
  gameState,
  localPlayerId,
  freezeTokenAnimations = false,
  children,
}: {
  gameState: GameState
  localPlayerId?: string
  freezeTokenAnimations?: boolean
  children: ReactNode
}) {
  const versionCursorRef = useRef({ version: -1, eventCount: 0 })
  const skipHistoryRef = useRef(true)
  const pendingRef = useRef(new Map<string, PendingTrigger>())
  const exitTimersRef = useRef(new Map<string, number>())
  const [flashStack, setFlashStack] = useState<RuneTriggerFlashItem[]>([])

  const removeFlash = useCallback((key: string) => {
    const exitTimer = exitTimersRef.current.get(key)
    if (exitTimer) {
      window.clearTimeout(exitTimer)
      exitTimersRef.current.delete(key)
    }
    setFlashStack((stack) => stack.filter((item) => item.key !== key))
  }, [])

  const beginFlashExit = useCallback(
    (key: string) => {
      setFlashStack((stack) =>
        stack.map((item) => (item.key === key ? { ...item, exiting: true } : item)),
      )
      const exitTimer = window.setTimeout(() => removeFlash(key), RUNE_TRIGGER_FLASH_EXIT_MS)
      exitTimersRef.current.set(key, exitTimer)
    },
    [removeFlash],
  )

  const enqueueFlashes = useCallback(
    (cardTypes: RuneCardType[]) => {
      if (cardTypes.length === 0) return

      const additions: RuneTriggerFlashItem[] = cardTypes.map((cardType, index) => ({
        key: `${cardType}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        cardType,
      }))

      setFlashStack((stack) => {
        const merged = [...stack, ...additions]
        if (merged.length <= RUNE_TRIGGER_FLASH_MAX_STACK) {
          return merged
        }
        const overflow = merged.length - RUNE_TRIGGER_FLASH_MAX_STACK
        const dropped = merged.slice(0, overflow)
        dropped.forEach((item) => {
          const timer = exitTimersRef.current.get(item.key)
          if (timer) {
            window.clearTimeout(timer)
            exitTimersRef.current.delete(item.key)
          }
        })
        return merged.slice(overflow)
      })

      additions.forEach((item) => {
        window.setTimeout(() => beginFlashExit(item.key), RUNE_TRIGGER_FLASH_HOLD_MS)
      })
    },
    [beginFlashExit],
  )

  useEffect(() => {
    return () => {
      exitTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      exitTimersRef.current.clear()
    }
  }, [])

  const consumeTriggersAtCells = useCallback(
    (tokenId: string, cellIds: number[]) => {
      if (cellIds.length === 0) return
      const targets = new Set(cellIds)
      const triggered: RuneCardType[] = []
      for (const [markerId, trigger] of pendingRef.current) {
        if (trigger.tokenId && trigger.tokenId !== tokenId) continue
        if (!targets.has(trigger.cellId)) continue
        pendingRef.current.delete(markerId)
        triggered.push(trigger.cardType)
      }
      enqueueFlashes(triggered)
    },
    [enqueueFlashes],
  )

  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      updateVersionCursor(gameState, versionCursorRef.current)
      return
    }

    if (freezeTokenAnimations || !localPlayerId || !gameState.config.runesEnabled) {
      if (!freezeTokenAnimations) {
        updateVersionCursor(gameState, versionCursorRef.current)
      }
      return
    }

    const deltaEvents = getDeltaEventsSinceVersion(gameState, versionCursorRef.current)
    deltaEvents.forEach((event) => {
      if (event.type !== 'marker_triggered') return
      if (event.playerId !== localPlayerId) return
      const markerId = event.details?.markerId
      const cellId = event.details?.cellId
      const rawCardType = event.details?.cardType
      if (typeof markerId !== 'string' || typeof cellId !== 'number') return
      if (typeof rawCardType !== 'string') return
      const cardType = rawCardType as RuneCardType
      if (!isBoardMarkerCardType(cardType)) return
      pendingRef.current.set(markerId, {
        markerId,
        cellId,
        cardType,
        tokenId: findMoveTokenIdForTrigger(deltaEvents, event.playerId),
      })
    })

    updateVersionCursor(gameState, versionCursorRef.current)
  }, [freezeTokenAnimations, gameState, localPlayerId])

  const notifyMarkerVisualTrigger = useCallback(
    (
      tokenId: string,
      playerSlot: number,
      step: MockPathStep,
      worldX?: number,
      worldZ?: number,
    ) => {
      if (!localPlayerId || freezeTokenAnimations) return
      const cellIds = resolveLandedCellIds(playerSlot, step, worldX, worldZ)
      consumeTriggersAtCells(tokenId, cellIds)
    },
    [consumeTriggersAtCells, freezeTokenAnimations, localPlayerId],
  )

  const notifyTeleportBurstSkippedMarkers = useCallback(
    (tokenId: string, playerSlot: number, remainingPathSteps: MockPathStep[]) => {
      if (!localPlayerId || freezeTokenAnimations) return
      const remainingCellIds = cellIdsForPathSteps(playerSlot, remainingPathSteps)
      const triggered: RuneCardType[] = []
      for (const [markerId, trigger] of pendingRef.current) {
        if (trigger.tokenId && trigger.tokenId !== tokenId) continue
        if (remainingCellIds.has(trigger.cellId)) continue
        pendingRef.current.delete(markerId)
        triggered.push(trigger.cardType)
      }
      enqueueFlashes(triggered)
    },
    [enqueueFlashes, freezeTokenAnimations, localPlayerId],
  )

  const value = useMemo(
    () => ({
      flashStack,
      notifyMarkerVisualTrigger,
      notifyTeleportBurstSkippedMarkers,
    }),
    [flashStack, notifyMarkerVisualTrigger, notifyTeleportBurstSkippedMarkers],
  )

  return (
    <RuneTriggerFlashContext.Provider value={value}>{children}</RuneTriggerFlashContext.Provider>
  )
}

export function useRuneTriggerFlash() {
  return useContext(RuneTriggerFlashContext)
}
