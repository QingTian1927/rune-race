import type { BoardMarker, GameEvent, GameState, LegalMove } from '@rune-race/shared'
import { RUNE_CARD_DEFINITIONS } from '@rune-race/shared'
import type { MockMoveEventDetails, MockPathStep } from '../engine.js'
import { isExitBaseLegalMove } from '../engine.js'
import { getEngineApi } from '../engine-api.js'
import { cellIdForTokenOnTrack, markerAtCell } from './board-cells.js'
import { applyFreezeToToken, beginNormalTurn, isTokenFrozen } from './turn-lifecycle.js'

type StepDirection = 'forward' | 'backward'

function now() {
  return Date.now()
}

function baseSlotForToken(tokenId: string) {
  const match = tokenId.match(/:(\d+)$/)
  return match ? Number(match[1]) : 0
}

function trackProgress(token: GameState['tokens'][number]) {
  const { BOARD_TRACK_LENGTH } = getEngineApi()
  if (token.state === 'on_track') return token.position
  if (token.state === 'in_home_lane') return BOARD_TRACK_LENGTH + token.position
  return -1
}

function applyStep(token: GameState['tokens'][number], direction: StepDirection): GameState['tokens'][number] | null {
  if (token.state === 'finished' || token.state === 'in_base') return null

  const { BOARD_TRACK_LENGTH, BOARD_HOME_LANE_LENGTH } = getEngineApi()
  const progress = trackProgress(token)
  if (progress < 0) return null

  const maxProgress = BOARD_TRACK_LENGTH + BOARD_HOME_LANE_LENGTH - 1
  const delta = direction === 'forward' ? 1 : -1
  const nextProgress = progress + delta

  if (nextProgress < 0) return { ...token, state: 'on_track', position: 0 }
  if (nextProgress > maxProgress) return null

  if (nextProgress <= BOARD_TRACK_LENGTH - 1) {
    return { ...token, state: 'on_track', position: nextProgress }
  }
  if (nextProgress <= maxProgress) {
    return { ...token, state: 'in_home_lane', position: nextProgress - BOARD_TRACK_LENGTH }
  }
  return null
}

function updateTokenInList(tokens: GameState['tokens'], tokenId: string, patch: Partial<GameState['tokens'][number]>) {
  return tokens.map((t) => (t.id === tokenId ? { ...t, ...patch } : t))
}

function removeMarker(state: GameState, markerId: string): GameState {
  if (!state.rune) return state
  return {
    ...state,
    rune: {
      ...state.rune,
      markers: state.rune.markers.filter((m) => m.markerId !== markerId),
    },
  }
}

function pushMarkerTriggered(
  events: GameEvent[],
  timestamp: number,
  playerId: string,
  marker: BoardMarker,
  effect: string,
) {
  events.push({
    type: 'marker_triggered',
    timestamp,
    playerId,
    details: { markerId: marker.markerId, cellId: marker.cellId, cardType: marker.cardType, effect },
  })
}

function trySpawnFromBase(state: GameState, playerId: string, timestamp: number): GameState {
  const inBase = state.tokens.filter((t) => t.playerId === playerId && t.state === 'in_base')
  if (inBase.length === 0) return state

  const spawnTarget = inBase[0]!
  const ownAtStart = state.tokens.some(
    (t) => t.playerId === playerId && t.state === 'on_track' && t.position === 0,
  )
  if (ownAtStart) return state

  const spawnTargetOnTrack = { ...spawnTarget, state: 'on_track' as const, position: 0 }
  const tokens = state.tokens.map((t) => (t.id === spawnTarget.id ? spawnTargetOnTrack : t))
  let next: GameState = {
    ...state,
    tokens,
    events: [
      ...state.events,
      {
        type: 'token_moved',
        timestamp,
        playerId,
        details: {
          tokenId: spawnTarget.id,
          moveType: 'spawn',
          from: { state: 'in_base', position: spawnTarget.position },
          to: { state: 'on_track', position: 0 },
          path: [{ state: 'on_track', position: 0 }],
        },
      },
    ],
  }

  return applyTraditionalCapture(next, spawnTargetOnTrack, { state: 'on_track', position: 0 }, timestamp)
}

function sendTokenHome(state: GameState, tokenId: string, timestamp: number): GameState {
  const token = state.tokens.find((t) => t.id === tokenId)
  if (!token) return state
  const slot = baseSlotForToken(tokenId)
  const tokens = state.tokens.map((t) =>
    t.id === tokenId
      ? {
          ...t,
          state: 'in_base' as const,
          position: slot,
          hasShield: false,
          freezeTurnsRemaining: 0,
        }
      : t,
  )
  return {
    ...state,
    tokens,
    events: [
      ...state.events,
      {
        type: 'horse_status_changed',
        timestamp,
        playerId: token.playerId,
        details: {
          tokenId,
          status: 'sent_home',
          from: { state: token.state, position: token.position },
          to: { state: 'in_base' as const, position: slot },
        },
      },
    ],
  }
}

type MoveSession = {
  state: GameState
  direction: StepDirection
  remainingSteps: number
  tokenId: string
  stopped: boolean
  path: MockPathStep[]
  /** Steps from rune ADVANCE/BACK markers that should teleport on the client. */
  runeStepsRemaining: number
}

function resolvePassThrough(
  session: MoveSession,
  marker: BoardMarker,
  timestamp: number,
): MoveSession {
  let { state, direction, remainingSteps, tokenId, stopped } = session
  const def = RUNE_CARD_DEFINITIONS[marker.cardType]
  if (def.triggerMode !== 'PASS_THROUGH') return session

  const token = state.tokens.find((t) => t.id === tokenId)!
  const events = [...state.events]
  pushMarkerTriggered(events, timestamp, token.playerId, marker, marker.cardType)
  state = { ...state, events }
  state = removeMarker(state, marker.markerId)

  const isTrap = def.category === 'TRAP'
  const hasShield = Boolean(token.hasShield)

  if (isTrap && hasShield) {
    state = {
      ...state,
      tokens: updateTokenInList(state.tokens, tokenId, { hasShield: false }),
      events: [
        ...state.events,
        {
          type: 'horse_status_changed',
          timestamp,
          playerId: token.playerId,
          details: {
            tokenId,
            status: 'shield_consumed',
            at: { state: token.state, position: token.position },
          },
        },
      ],
    }
    return { ...session, state }
  }

  if (marker.cardType === 'SHIELD') {
    const already = Boolean(token.hasShield)
    if (!already) {
      state = {
        ...state,
        tokens: updateTokenInList(state.tokens, tokenId, { hasShield: true }),
        events: [
          ...state.events,
          {
            type: 'horse_status_changed',
            timestamp,
            playerId: token.playerId,
            details: {
              tokenId,
              status: 'shield_granted',
              at: { state: token.state, position: token.position },
            },
          },
        ],
      }
    }
    return { ...session, state }
  }

  if (marker.cardType === 'FREEZE') {
    state = applyFreezeToToken(state, tokenId, timestamp)
    return { ...session, state, remainingSteps: 0, stopped: true }
  }

  if (marker.cardType.startsWith('ADVANCE_') && def.stepValue) {
    const n = def.stepValue
    if (direction === 'backward') {
      return {
        ...session,
        state,
        direction: 'forward',
        remainingSteps: n,
        stopped: false,
        runeStepsRemaining: session.runeStepsRemaining + n,
      }
    }
    return {
      ...session,
      state,
      remainingSteps: remainingSteps + n,
      stopped: false,
      runeStepsRemaining: session.runeStepsRemaining + n,
    }
  }

  if (marker.cardType.startsWith('BACK_') && def.stepValue) {
    const n = def.stepValue
    if (direction === 'forward') {
      return {
        ...session,
        state,
        direction: 'backward',
        remainingSteps: n,
        stopped: false,
        runeStepsRemaining: session.runeStepsRemaining + n,
      }
    }
    return {
      ...session,
      state,
      remainingSteps: remainingSteps + n,
      stopped: false,
      runeStepsRemaining: session.runeStepsRemaining + n,
    }
  }

  return session
}

function resolveExactStop(
  session: MoveSession,
  marker: BoardMarker,
  timestamp: number,
): MoveSession {
  let { state, tokenId } = session
  const def = RUNE_CARD_DEFINITIONS[marker.cardType]
  if (def.triggerMode !== 'EXACT_STOP') return session

  const token = state.tokens.find((t) => t.id === tokenId)!
  const events = [...state.events]
  pushMarkerTriggered(events, timestamp, token.playerId, marker, marker.cardType)
  state = { ...state, events }
  state = removeMarker(state, marker.markerId)

  const isTrap = def.category === 'TRAP'
  const hasShield = Boolean(token.hasShield)

  if (isTrap && hasShield && marker.cardType === 'SEND_HOME') {
    state = {
      ...state,
      tokens: updateTokenInList(state.tokens, tokenId, { hasShield: false }),
      events: [
        ...state.events,
        {
          type: 'horse_status_changed',
          timestamp,
          playerId: token.playerId,
          details: {
            tokenId,
            status: 'shield_consumed',
            at: { state: token.state, position: token.position },
          },
        },
      ],
    }
    return { ...session, state }
  }

  if (marker.cardType === 'SEND_HOME') {
    state = sendTokenHome(state, tokenId, timestamp)
    return { ...session, state, stopped: true, remainingSteps: 0 }
  }

  if (marker.cardType === 'LEAVE_STABLE') {
    state = trySpawnFromBase(state, token.playerId, timestamp)
    return { ...session, state }
  }

  if (marker.cardType === 'SWAP') {
    const displayedId = marker.displayedIdentityId
    if (displayedId === token.playerId) {
      return {
        ...session,
        state: pushSwapNoEffect(state, tokenId, token.playerId, 'self_identity', timestamp),
      }
    }
    const swapTargets = state.tokens.filter(
      (t) =>
        t.playerId === displayedId &&
        t.state === 'on_track' &&
        t.id !== tokenId,
    )
    if (swapTargets.length === 0) {
      return {
        ...session,
        state: pushSwapNoEffect(state, tokenId, token.playerId, 'no_targets', timestamp),
      }
    }
    if (swapTargets.length === 1) {
      return {
        ...session,
        state: applyTokenSwap(state, tokenId, swapTargets[0]!.id, token.playerId, timestamp, {
          automatic: true,
        }),
        remainingSteps: 0,
        stopped: true,
      }
    }
    return {
      ...session,
      state: {
        ...state,
        turn: {
          ...state.turn,
          phase: 'waiting_swap_choice',
          pendingSwap: {
            markerId: marker.markerId,
            activatorTokenId: tokenId,
            displayedIdentityId: displayedId,
          },
        },
        phase: 'waiting_swap_choice',
      },
      remainingSteps: 0,
      stopped: true,
    }
  }

  return { ...session, state }
}

function runStepLoop(session: MoveSession, timestamp: number): MoveSession {
  let current = session
  while (current.remainingSteps > 0 && !current.stopped) {
    const token = current.state.tokens.find((t) => t.id === current.tokenId)
    if (!token) break

    const stepped = applyStep(token, current.direction)
    if (!stepped) break

    const isRuneStep = current.runeStepsRemaining > 0
    const nextRuneRemaining = isRuneStep ? current.runeStepsRemaining - 1 : 0
    const runeBurstDone = isRuneStep && nextRuneRemaining === 0

    const events = [...current.state.events]
    events.push({
      type: 'token_stepped',
      timestamp,
      playerId: token.playerId,
      details: {
        tokenId: current.tokenId,
        from: { state: token.state, position: token.position },
        to: { state: stepped.state, position: stepped.position },
        direction: current.direction,
        motion: runeBurstDone ? 'teleport' : isRuneStep ? 'rune_step' : 'step',
      },
    })

    let state: GameState = {
      ...current.state,
      tokens: updateTokenInList(current.state.tokens, current.tokenId, stepped),
      events,
    }

    const pathAdd: MockPathStep[] = []
    if (isRuneStep) {
      if (runeBurstDone) {
        pathAdd.push({
          state: stepped.state,
          position: stepped.position,
          motion: 'teleport',
        })
      }
    } else {
      pathAdd.push({
        state: stepped.state,
        position: stepped.position,
        motion: 'step',
      })
    }

    current = {
      ...current,
      state,
      path: [...current.path, ...pathAdd],
      remainingSteps: current.remainingSteps - 1,
      runeStepsRemaining: nextRuneRemaining,
    }

    const cellId = cellIdForTokenOnTrack(state, stepped)
    if (cellId !== null && state.rune) {
      const marker = markerAtCell(state.rune.markers, cellId)
      if (marker) {
        current = resolvePassThrough({ ...current, state }, marker, timestamp)
        state = current.state
      }
    }
  }

  const finalToken = current.state.tokens.find((t) => t.id === current.tokenId)
  if (finalToken && current.state.rune) {
    const cellId = cellIdForTokenOnTrack(current.state, finalToken)
    if (cellId !== null) {
      const marker = markerAtCell(current.state.rune.markers, cellId)
      if (marker) {
        current = resolveExactStop({ ...current, state: current.state }, marker, timestamp)
      }
    }
  }

  return current
}

function applyTraditionalCapture(
  state: GameState,
  moveToken: GameState['tokens'][number],
  pathTo: MockPathStep,
  timestamp: number,
): GameState {
  if (pathTo.state !== 'on_track') return state

  const { boardSlotForPlayer, absoluteTrackIndexFor } = getEngineApi()
  const moverSlot = boardSlotForPlayer(state, moveToken.playerId)
  const destinationAbsoluteTrack = absoluteTrackIndexFor(moverSlot, pathTo.position)

  const capturedToken = state.tokens.find((candidate) => {
    if (candidate.playerId === moveToken.playerId || candidate.state !== 'on_track') return false
    const candidateSlot = boardSlotForPlayer(state, candidate.playerId)
    if (candidateSlot < 0) return false
    return absoluteTrackIndexFor(candidateSlot, candidate.position) === destinationAbsoluteTrack
  })

  if (!capturedToken) return state

  const captureSlot = baseSlotForToken(capturedToken.id)
  const tokens = state.tokens.map((t) =>
    t.id === capturedToken.id
      ? {
          ...t,
          state: 'in_base' as const,
          position: captureSlot,
          hasShield: false,
          freezeTurnsRemaining: 0,
        }
      : t,
  )

  return {
    ...state,
    tokens,
    events: [
      ...state.events,
      {
        type: 'token_captured',
        timestamp,
        playerId: moveToken.playerId,
        details: {
          tokenId: moveToken.id,
          playerId: moveToken.playerId,
          capturedTokenId: capturedToken.id,
          from: pathTo,
          to: { state: 'in_base', position: captureSlot },
        },
      },
    ],
  }
}

function finalizeTurnAfterMove(
  state: GameState,
  moveToken: GameState['tokens'][number],
  diceResult: number,
  pathInfo: { from: MockPathStep; to: MockPathStep; path: MockPathStep[]; moveType: LegalMove['moveType'] },
  timestamp: number,
): GameState {
  const {
    appendFinishEvents,
    getNextPlayerIndex,
    shouldEndGameByFinishCount,
    syncCurrentPlayerIndex,
  } = getEngineApi()

  const events = [...state.events]
  events.push({
    type: 'token_moved',
    timestamp,
    playerId: moveToken.playerId,
    details: {
      tokenId: moveToken.id,
      moveType: pathInfo.moveType,
      from: pathInfo.from,
      to: pathInfo.to,
      path: pathInfo.path,
    } as MockMoveEventDetails,
  })

  let next: GameState = { ...state, events }

  if (state.turn.phase === 'waiting_swap_choice') {
    return { ...next, version: next.version + 1, updatedAt: timestamp }
  }

  const keepCurrentPlayer = diceResult === 6 && !state.turn.isBonusTurn
  next = applyTraditionalCapture(next, moveToken, pathInfo.to, timestamp)

  const finishData = appendFinishEvents(next, next.tokens, timestamp, moveToken.playerId)
  next = { ...next, events: finishData.events }

  const shouldEndGame = shouldEndGameByFinishCount(next.players.length, finishData.finishOrder.length)
  if (shouldEndGame) {
    return syncCurrentPlayerIndex({
      ...next,
      version: next.version + 1,
      status: 'finished',
      winnerId: finishData.finishOrder[0],
      turn: {
        ...next.turn,
        diceResult: null,
        phase: 'turn_end',
        legalMoves: [],
        pendingSwap: null,
      },
      phase: 'turn_end',
      updatedAt: timestamp,
    })
  }

  const finishedByRank = new Set(finishData.finishOrder)
  const nextPlayerIndex =
    keepCurrentPlayer && !finishedByRank.has(moveToken.playerId)
      ? next.currentPlayerIndex
      : getNextPlayerIndex({ ...next, events: finishData.events }, false)
  const nextPlayer = next.players[nextPlayerIndex] ?? next.players[0]

  events.push({
    type: 'turn_advanced',
    timestamp,
    playerId: moveToken.playerId,
    details: {
      nextPlayerId: nextPlayer?.id ?? moveToken.playerId,
      reason: keepCurrentPlayer ? 'extra_turn' : 'normal_turn',
    },
  })

  let resolved: GameState = syncCurrentPlayerIndex({
    ...next,
    version: next.version + 1,
    currentPlayerIndex: nextPlayerIndex,
    turn: {
      ...next.turn,
      currentPlayerId: nextPlayer?.id ?? moveToken.playerId,
      diceResult: null,
      legalMoves: [],
      pendingSwap: null,
      isBonusTurn: false,
    },
    phase: 'turn_end',
    updatedAt: timestamp,
    events: [...finishData.events, events[events.length - 1]!],
  })

  if (keepCurrentPlayer && !finishedByRank.has(moveToken.playerId)) {
    return beginBonusTurnAfterMove(resolved)
  }

  if (resolved.config.runesEnabled) {
    return beginNormalTurn(resolved)
  }

  return getEngineApi().syncCurrentPlayerIndex({
    ...resolved,
    turn: { ...resolved.turn, phase: 'waiting_roll' },
    phase: 'waiting_roll',
  })
}

function beginBonusTurnAfterMove(state: GameState): GameState {
  const timestamp = now()
  const { syncCurrentPlayerIndex } = getEngineApi()
  return syncCurrentPlayerIndex({
    ...state,
    turn: {
      ...state.turn,
      phase: 'waiting_roll',
      isBonusTurn: true,
      currentPlayerId: state.turn.currentPlayerId,
    },
    phase: 'waiting_roll',
    updatedAt: timestamp,
  })
}

export function resolveMoveWithRunes(state: GameState, chosenMove: LegalMove): GameState {
  const timestamp = now()
  const diceResult = state.turn.diceResult ?? 0
  const moveToken = state.tokens.find((t) => t.id === chosenMove.tokenId)
  if (!moveToken || !state.rune) {
    return state
  }
  if (isTokenFrozen(moveToken)) {
    return state
  }

  let pathInfo: {
    from: MockPathStep
    to: MockPathStep
    path: MockPathStep[]
    moveType: LegalMove['moveType']
  }

  if (moveToken.state === 'in_base' && isExitBaseLegalMove(chosenMove, state.tokens)) {
    pathInfo = {
      from: { state: 'in_base', position: moveToken.position },
      to: { state: 'on_track', position: 0 },
      path: [{ state: 'on_track', position: 0 }],
      moveType: chosenMove.moveType,
    }
    let tokens = updateTokenInList(state.tokens, moveToken.id, {
      state: 'on_track',
      position: 0,
    })
    let working: GameState = { ...state, tokens }

    const cellId = cellIdForTokenOnTrack(working, { ...moveToken, state: 'on_track', position: 0 })
    if (cellId !== null && working.rune) {
      const marker = markerAtCell(working.rune.markers, cellId)
      if (marker) {
        let session: MoveSession = {
          state: working,
          direction: 'forward',
          remainingSteps: 0,
          tokenId: moveToken.id,
          stopped: false,
          path: [{ state: 'on_track', position: 0, motion: 'step' }],
          runeStepsRemaining: 0,
        }
        session = resolvePassThrough(session, marker, timestamp)
        session = resolveExactStop(session, marker, timestamp)
        if (session.remainingSteps > 0 && !session.stopped) {
          session = runStepLoop(session, timestamp)
        }
        working = session.state
        pathInfo.path = session.path
      }
    }

    const finalToken = working.tokens.find((t) => t.id === moveToken.id)!
    pathInfo.to = { state: finalToken.state, position: finalToken.position }

    return finalizeTurnAfterMove(working, moveToken, diceResult, pathInfo, timestamp)
  }

  const startProgress = trackProgress(moveToken)
  if (startProgress < 0) return state

  let session: MoveSession = {
    state,
    direction: 'forward',
    remainingSteps: diceResult,
    tokenId: moveToken.id,
    stopped: false,
    path: [],
    runeStepsRemaining: 0,
  }

  session = runStepLoop(session, timestamp)
  const finalToken = session.state.tokens.find((t) => t.id === moveToken.id)!
  pathInfo = {
    from: { state: moveToken.state, position: moveToken.position },
    to: { state: finalToken.state, position: finalToken.position },
    path: session.path,
    moveType: chosenMove.moveType,
  }

  return finalizeTurnAfterMove(session.state, moveToken, diceResult, pathInfo, timestamp)
}

function pushSwapNoEffect(
  state: GameState,
  tokenId: string,
  playerId: string,
  reason: 'self_identity' | 'no_targets',
  timestamp: number,
): GameState {
  return {
    ...state,
    events: [
      ...state.events,
      {
        type: 'horse_status_changed',
        timestamp,
        playerId,
        details: { tokenId, status: 'swap_no_effect', reason },
      },
    ],
  }
}

function applyTokenSwap(
  state: GameState,
  activatorTokenId: string,
  targetTokenId: string,
  actingPlayerId: string,
  timestamp: number,
  options?: { automatic?: boolean },
): GameState {
  const activator = state.tokens.find((t) => t.id === activatorTokenId)
  const target = state.tokens.find((t) => t.id === targetTokenId)
  if (!activator || !target) return state

  const activatorFrom = { state: activator.state, position: activator.position }
  const targetFrom = { state: target.state, position: target.position }

  let activatorTo = { ...activatorFrom }
  let targetTo = { ...targetFrom }

  if (activator.state === 'on_track' && target.state === 'on_track') {
    const { boardSlotForPlayer, absoluteTrackIndexFor, trackProgressForAbsoluteIndex } = getEngineApi()
    const activatorSlot = boardSlotForPlayer(state, activator.playerId)
    const targetSlot = boardSlotForPlayer(state, target.playerId)
    if (activatorSlot >= 0 && targetSlot >= 0) {
      const activatorAbs = absoluteTrackIndexFor(activatorSlot, activator.position)
      const targetAbs = absoluteTrackIndexFor(targetSlot, target.position)
      const nextActivatorProgress = trackProgressForAbsoluteIndex(activatorSlot, targetAbs)
      const nextTargetProgress = trackProgressForAbsoluteIndex(targetSlot, activatorAbs)
      if (nextActivatorProgress !== null && nextTargetProgress !== null) {
        activatorTo = { state: 'on_track' as const, position: nextActivatorProgress }
        targetTo = { state: 'on_track' as const, position: nextTargetProgress }
      }
    }
  }

  const tokens = state.tokens.map((t) => {
    if (t.id === activator.id) return { ...t, state: activatorTo.state, position: activatorTo.position }
    if (t.id === target.id) return { ...t, state: targetTo.state, position: targetTo.position }
    return t
  })

  return {
    ...state,
    tokens,
    events: [
      ...state.events,
      {
        type: 'token_swapped',
        timestamp,
        playerId: actingPlayerId,
        details: {
          activatorTokenId: activator.id,
          targetTokenId: target.id,
          activatorFrom,
          activatorTo,
          targetFrom,
          targetTo,
          ...(options?.automatic ? { automatic: true } : {}),
        },
      },
    ],
  }
}

export function resolveSwapChoice(state: GameState, playerId: string, targetTokenId: string): GameState {
  const pending = state.turn.pendingSwap
  if (!pending || state.turn.phase !== 'waiting_swap_choice') return state
  if (state.turn.currentPlayerId !== playerId) return state

  const activator = state.tokens.find((t) => t.id === pending.activatorTokenId)
  const target = state.tokens.find((t) => t.id === targetTokenId)
  if (!activator || !target) return state
  if (target.playerId !== pending.displayedIdentityId || target.state !== 'on_track') return state

  const timestamp = now()
  const activatorFrom = { state: activator.state, position: activator.position }

  let next = applyTokenSwap(state, activator.id, target.id, playerId, timestamp)
  const activatorAfter = next.tokens.find((t) => t.id === activator.id)!
  next = {
    ...next,
    turn: { ...next.turn, phase: 'turn_end', pendingSwap: null },
    phase: 'turn_end',
  }

  const diceResult = state.turn.diceResult ?? 0
  const pathInfo = {
    from: activatorFrom,
    to: { state: activatorAfter.state, position: activatorAfter.position },
    path: [],
    moveType: 'move' as const,
  }

  return finalizeTurnAfterMove(next, activatorAfter, diceResult, pathInfo, timestamp)
}
