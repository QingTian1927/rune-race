import { readFileSync } from 'node:fs'
import type { GameEvent, GameState, LegalMove, Player, TokenState } from '@rune-race/shared'
import { PLAYER_COLORS } from '@rune-race/shared'

type BoardLayout = {
  meta: {
    mainTrackSteps: number
    homeLaneStepsPerPlayer: number
    direction: 'cw' | 'ccw'
  }
  players: Array<{ startIndex: number }>
}

const boardLayout = JSON.parse(
  readFileSync(new URL('../data/board-layout.json', import.meta.url), 'utf-8'),
) as BoardLayout

export const MOCK_PLAYER_COUNT = 4
export const BOARD_TRACK_LENGTH = boardLayout.meta.mainTrackSteps
export const BOARD_HOME_LANE_LENGTH = boardLayout.meta.homeLaneStepsPerPlayer
export const BOARD_DIRECTION_MULTIPLIER = boardLayout.meta.direction === 'cw' ? -1 : 1

export type MockPathStep = {
  state: TokenState
  position: number
}

export type MockMoveEventDetails = {
  tokenId: string
  playerId: string
  moveType: LegalMove['moveType']
  from: MockPathStep
  to: MockPathStep
  path: MockPathStep[]
  capturedTokenId?: string
}

type MutableToken = GameState['tokens'][number] & {
  _baseSlot?: number
}

function now() {
  return Date.now()
}

function clonePlayers(playerCount = MOCK_PLAYER_COUNT): Player[] {
  return boardLayout.players.slice(0, playerCount).map((_, index) => ({
    id: `player-${PLAYER_COLORS[index]}`,
    name: `Player ${PLAYER_COLORS[index].charAt(0).toUpperCase()}${PLAYER_COLORS[index].slice(1)}`,
    color: PLAYER_COLORS[index],
  }))
}

function createBaseTokens(players: Player[]): MutableToken[] {
  const tokens: MutableToken[] = []

  players.forEach((player) => {
    for (let tokenIndex = 0; tokenIndex < 4; tokenIndex += 1) {
      tokens.push({
        id: `${player.id}:${tokenIndex}`,
        playerId: player.id,
        position: tokenIndex,
        state: 'in_base',
        _baseSlot: tokenIndex,
      })
    }
  })

  return tokens
}

export function createMockGameState(playerCount = MOCK_PLAYER_COUNT): GameState {
  const players = clonePlayers(playerCount)
  return createInitialGameState({
    gameId: 'mock-room',
    players,
    firstPlayerId: players[0]?.id ?? 'player-red',
  })
}

export function createInitialGameState(params: {
  gameId: string
  players: Player[]
  firstPlayerId: string
}): GameState {
  const players = sortPlayersByColor(params.players)
  if (players.length < 2 || players.length > 4) {
    throw new Error('Game requires 2–4 players')
  }

  const currentPlayerIndex = Math.max(
    0,
    players.findIndex((p) => p.id === params.firstPlayerId),
  )
  const currentPlayerId = players[currentPlayerIndex]?.id ?? players[0].id
  const timestamp = now()

  return {
    roomId: params.gameId,
    version: 1,
    players,
    tokens: createBaseTokens(players),
    turn: {
      id: `${params.gameId}:turn:1`,
      currentPlayerId,
      diceResult: null,
      phase: 'waiting_roll',
      legalMoves: [],
      startTime: timestamp,
    },
    phase: 'waiting_roll',
    status: 'playing',
    currentPlayerIndex,
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [],
  }
}

export type RollDiceFn = () => number

function defaultRollDice(): number {
  return Math.floor(Math.random() * 6) + 1
}

function safeTrackIndices(state: GameState) {
  const indices = new Set<number>()
  state.players.forEach((player) => {
    const slot = boardSlotForPlayer(state, player.id)
    const layout = boardLayout.players[slot]
    if (layout) {
      indices.add(layout.startIndex)
    }
  })
  return indices
}

function absoluteTrackIndexFor(playerIndex: number, progress: number) {
  const playerLayout = boardLayout.players[playerIndex]
  if (!playerLayout) {
    return -1
  }

  const raw = playerLayout.startIndex + progress * BOARD_DIRECTION_MULTIPLIER
  return ((raw % BOARD_TRACK_LENGTH) + BOARD_TRACK_LENGTH) % BOARD_TRACK_LENGTH
}

/** Board layout slot (0–3) from player color — stable for 2–4 player games. */
function boardSlotForPlayer(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return -1
  return PLAYER_COLORS.indexOf(player.color)
}

export function sortPlayersByColor(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => PLAYER_COLORS.indexOf(a.color) - PLAYER_COLORS.indexOf(b.color),
  )
}

/** Keep currentPlayerIndex aligned with turn.currentPlayerId after turn changes. */
export function syncCurrentPlayerIndex(state: GameState): GameState {
  const index = state.players.findIndex((p) => p.id === state.turn.currentPlayerId)
  if (index < 0 || index === state.currentPlayerIndex) {
    return state
  }
  return { ...state, currentPlayerIndex: index }
}

function getTrackProgressStepCount(token: GameState['tokens'][number]) {
  if (token.state === 'on_track') {
    return token.position
  }

  if (token.state === 'in_home_lane') {
    return BOARD_TRACK_LENGTH + token.position
  }

  return -1
}

function progressToTokenState(progress: number): MockPathStep | null {
  const entryProgress = BOARD_TRACK_LENGTH - 1
  const lastHomeLaneProgress = BOARD_TRACK_LENGTH + BOARD_HOME_LANE_LENGTH - 1

  if (progress <= entryProgress) {
    return { state: 'on_track', position: progress }
  }

  if (progress <= lastHomeLaneProgress) {
    return { state: 'in_home_lane', position: progress - BOARD_TRACK_LENGTH }
  }

  return null
}

function baseSlotForToken(tokenId: string) {
  const match = tokenId.match(/:(\d+)$/)
  return match ? Number(match[1]) : 0
}

function canSpawnFromBase(diceResult: number) {
  return diceResult === 1 || diceResult === 6
}

function tokenPathFromMove(token: GameState['tokens'][number], diceResult: number) {
  const maxProgress = BOARD_TRACK_LENGTH + BOARD_HOME_LANE_LENGTH - 1

  if (token.state === 'in_base') {
    if (!canSpawnFromBase(diceResult)) {
      return null
    }

    return {
      from: { state: 'in_base' as const, position: token.position },
      to: { state: 'on_track' as const, position: 0 },
      path: [{ state: 'on_track' as const, position: 0 }],
      moveType: 'spawn' as const,
    }
  }

  if (token.state === 'finished') {
    return null
  }

  const startProgress = getTrackProgressStepCount(token)
  if (startProgress < 0) {
    return null
  }

  const targetProgress = startProgress + diceResult
  if (targetProgress > maxProgress) {
    return null
  }

  const path: MockPathStep[] = []
  for (let progress = startProgress + 1; progress <= targetProgress; progress += 1) {
    const step = progressToTokenState(progress)
    if (!step) {
      return null
    }
    path.push(step)
  }

  const finalState = progressToTokenState(targetProgress)
  if (!finalState) {
    return null
  }

  return {
    from: { state: token.state, position: token.position },
    to: finalState,
    path,
    moveType: 'move' as const,
  }
}

function mapTrackOccupancy(tokens: GameState['tokens']) {
  const occupancy = new Map<string, GameState['tokens'][number]>()
  tokens.forEach((token) => {
    if (token.state !== 'on_track') {
      return
    }

    occupancy.set(`${token.playerId}:${token.position}`, token)
  })
  return occupancy
}

function mapLaneOccupancy(tokens: GameState['tokens']) {
  const occupancy = new Map<string, GameState['tokens'][number]>()
  tokens.forEach((token) => {
    if (token.state !== 'in_home_lane') {
      return
    }

    occupancy.set(`${token.playerId}:${token.position}`, token)
  })
  return occupancy
}

function computeLegalMoves(state: GameState, diceResult: number): LegalMove[] {
  const trackOccupancy = mapTrackOccupancy(state.tokens)
  const laneOccupancy = mapLaneOccupancy(state.tokens)
  const safeTracks = safeTrackIndices(state)
  const legalMoves: LegalMove[] = []

  state.tokens
    .filter((token) => token.playerId === state.turn.currentPlayerId)
    .forEach((token) => {
      const path = tokenPathFromMove(token, diceResult)
      if (!path) {
        return
      }

      if (path.to.state === 'on_track') {
        const targetToken = trackOccupancy.get(`${token.playerId}:${path.to.position}`)
        if (targetToken) {
          return
        }

        const moverSlot = boardSlotForPlayer(state, token.playerId)
        const destinationAbsoluteTrack = absoluteTrackIndexFor(moverSlot, path.to.position)

        const capturedToken = state.tokens.find((candidate) => {
          if (candidate.playerId === token.playerId || candidate.state !== 'on_track') {
            return false
          }

          const candidateSlot = boardSlotForPlayer(state, candidate.playerId)
          if (candidateSlot < 0) {
            return false
          }

          return absoluteTrackIndexFor(candidateSlot, candidate.position) === destinationAbsoluteTrack
        })

        if (capturedToken && !safeTracks.has(destinationAbsoluteTrack)) {
          legalMoves.push({
            id: `${token.id}:${path.to.position}`,
            tokenId: token.id,
            destination: path.to.position,
            moveType: 'capture',
            capturedTokenId: capturedToken.id,
          })
          return
        }

        legalMoves.push({
          id: `${token.id}:${path.to.position}`,
          tokenId: token.id,
          destination: path.to.position,
          moveType: path.moveType,
        })
        return
      }

      if (path.to.state === 'in_home_lane') {
        const targetToken = laneOccupancy.get(`${token.playerId}:${path.to.position}`)
        if (targetToken) {
          return
        }

        legalMoves.push({
          id: `${token.id}:${path.to.position}`,
          tokenId: token.id,
          destination: path.to.position,
          moveType: path.moveType,
        })
      }
    })

  return legalMoves
}

function applyPathToToken(token: GameState['tokens'][number], path: MockPathStep[]) {
  if (path.length === 0) {
    return token
  }

  const lastStep = path[path.length - 1]
  return {
    ...token,
    state: lastStep.state,
    position: lastStep.position,
  }
}

function getNextPlayerIndex(state: GameState, keepCurrentPlayer: boolean) {
  if (state.players.length === 0) {
    return 0
  }

  const completedPlayerIds = new Set(getFinishOrderFromEvents(state.events))

  if (keepCurrentPlayer) {
    const currentPlayerId = state.players[state.currentPlayerIndex]?.id
    if (currentPlayerId && !completedPlayerIds.has(currentPlayerId)) {
      return state.currentPlayerIndex
    }
  }

  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidateIndex = (state.currentPlayerIndex + offset) % state.players.length
    const candidatePlayerId = state.players[candidateIndex]?.id
    if (candidatePlayerId && !completedPlayerIds.has(candidatePlayerId)) {
      return candidateIndex
    }
  }

  return state.currentPlayerIndex
}

function makeTurnId(state: GameState) {
  return `${state.roomId}:turn:${state.version + 1}`
}

function shouldAutoSpawnWithoutChoice(diceResult: number, legalMoves: LegalMove[]) {
  if (!canSpawnFromBase(diceResult) || legalMoves.length === 0) {
    return false
  }

  const hasSpawnMove = legalMoves.some((move) => move.moveType === 'spawn')
  const hasTrackOrLaneMove = legalMoves.some((move) => move.moveType !== 'spawn')
  return hasSpawnMove && !hasTrackOrLaneMove
}

/** Game ends when all but one player have finished (last place is implicit). */
export function shouldEndGameByFinishCount(playerCount: number, finishedCount: number): boolean {
  if (playerCount <= 0 || finishedCount <= 0) return false
  return finishedCount >= playerCount - 1
}

function getFinishOrderFromEvents(events: GameEvent[]) {
  const order: string[] = []
  const seen = new Set<string>()

  events.forEach((event) => {
    if (event.type !== 'token_finished') {
      return
    }

    const playerId = typeof event.details?.playerId === 'string' ? event.details.playerId : ''
    if (!playerId || seen.has(playerId)) {
      return
    }

    seen.add(playerId)
    order.push(playerId)
  })

  return order
}

function isTokenInFinalZone(token: GameState['tokens'][number]) {
  return token.state === 'in_home_lane' || token.state === 'finished'
}

function getPlayersFullyInHomeLane(players: Player[], tokens: GameState['tokens']) {
  return players
    .map((player) => player.id)
    .filter((playerId) => {
      const playerTokens = tokens.filter((token) => token.playerId === playerId)
      return playerTokens.length > 0 && playerTokens.every(isTokenInFinalZone)
    })
}

function appendFinishEvents(state: GameState, tokens: GameState['tokens'], timestamp: number, preferredPlayerId?: string) {
  const finishOrder = getFinishOrderFromEvents(state.events)
  const alreadyFinished = new Set(finishOrder)
  const fullyFinishedPlayers = getPlayersFullyInHomeLane(state.players, tokens)

  const newcomers = fullyFinishedPlayers.filter((playerId) => !alreadyFinished.has(playerId))
  if (newcomers.length === 0) {
    return { events: state.events, finishOrder }
  }

  if (preferredPlayerId && newcomers.includes(preferredPlayerId)) {
    newcomers.sort((a, b) => {
      if (a === preferredPlayerId) return -1
      if (b === preferredPlayerId) return 1
      const ai = state.players.findIndex((player) => player.id === a)
      const bi = state.players.findIndex((player) => player.id === b)
      return ai - bi
    })
  }

  const nextEvents = [...state.events]
  newcomers.forEach((playerId) => {
    finishOrder.push(playerId)
    nextEvents.push({
      type: 'token_finished',
      timestamp,
      playerId,
      details: {
        playerId,
        rank: finishOrder.length,
      },
    })
  })

  return { events: nextEvents, finishOrder }
}

function buildFinishedState(
  state: GameState,
  winnerId: string,
  events: GameEvent[],
  timestamp: number,
): GameState {
  return syncCurrentPlayerIndex({
    ...state,
    version: state.version + 1,
    status: 'finished',
    winnerId,
    turn: {
      id: makeTurnId(state),
      currentPlayerId: state.turn.currentPlayerId,
      diceResult: null,
      phase: 'turn_end',
      legalMoves: [],
      startTime: timestamp,
    },
    phase: 'turn_end',
    updatedAt: timestamp,
    events: [
      ...events,
      {
        type: 'turn_advanced',
        timestamp,
        playerId: state.turn.currentPlayerId,
        details: {
          nextPlayerId: winnerId,
          reason: 'game_finished',
        },
      },
    ],
  })
}

/** Remove a player who left mid-game; advance turn and drop their pieces from state. */
export function removePlayerFromGame(state: GameState, playerId: string): GameState {
  if (state.status === 'finished') {
    return state
  }

  const removeIndex = state.players.findIndex((p) => p.id === playerId)
  if (removeIndex < 0) {
    return state
  }

  const timestamp = now()
  const players = state.players.filter((p) => p.id !== playerId)
  const tokens = state.tokens.filter((t) => t.playerId !== playerId)
  let events: GameEvent[] = [
    ...state.events,
    {
      type: 'turn_advanced',
      timestamp,
      playerId,
      details: { leftPlayerId: playerId, reason: 'player_left' },
    },
  ]

  if (players.length === 0) {
    return {
      ...state,
      version: state.version + 1,
      status: 'finished',
      players: [],
      tokens: [],
      phase: 'turn_end',
      updatedAt: timestamp,
      events,
    }
  }

  if (players.length === 1) {
    return buildFinishedState(
      { ...state, players, tokens, events },
      players[0].id,
      events,
      timestamp,
    )
  }

  let currentPlayerIndex = state.currentPlayerIndex
  if (removeIndex < currentPlayerIndex) {
    currentPlayerIndex -= 1
  } else if (removeIndex === currentPlayerIndex) {
    currentPlayerIndex = currentPlayerIndex % players.length
  }

  const turnHeldByLeaving =
    state.turn.currentPlayerId === playerId ||
    !players.some((p) => p.id === state.turn.currentPlayerId)

  let next: GameState = {
    ...state,
    version: state.version + 1,
    players,
    tokens,
    currentPlayerIndex,
    events,
    updatedAt: timestamp,
  }

  if (turnHeldByLeaving) {
    const nextPlayerIndex = getNextPlayerIndex(next, false)
    const nextPlayer = players[nextPlayerIndex] ?? players[0]
    events = [
      ...events,
      {
        type: 'turn_advanced',
        timestamp,
        playerId,
        details: {
          nextPlayerId: nextPlayer.id,
          reason: 'player_left_advance',
        },
      },
    ]
    next = {
      ...next,
      currentPlayerIndex: nextPlayerIndex,
      turn: {
        id: makeTurnId(next),
        currentPlayerId: nextPlayer.id,
        diceResult: null,
        phase: 'waiting_roll',
        legalMoves: [],
        startTime: timestamp,
      },
      phase: 'waiting_roll',
      events,
    }
  }

  next = syncCurrentPlayerIndex(next)

  const finishOrder = getFinishOrderFromEvents(next.events)
  if (shouldEndGameByFinishCount(players.length, finishOrder.length)) {
    return buildFinishedState(next, finishOrder[0], next.events, timestamp)
  }

  return next
}

export function rollTurn(state: GameState, rollFn: RollDiceFn = defaultRollDice) {
  if (state.status === 'finished' || state.turn.phase !== 'waiting_roll') {
    return state
  }

  if (!state.players.some((p) => p.id === state.turn.currentPlayerId)) {
    const nextPlayerIndex = getNextPlayerIndex(state, false)
    const nextPlayer = state.players[nextPlayerIndex] ?? state.players[0]
    return syncCurrentPlayerIndex({
      ...state,
      version: state.version + 1,
      currentPlayerIndex: nextPlayerIndex,
      turn: {
        id: makeTurnId(state),
        currentPlayerId: nextPlayer?.id ?? state.turn.currentPlayerId,
        diceResult: null,
        phase: 'waiting_roll',
        legalMoves: [],
        startTime: now(),
      },
      phase: 'waiting_roll',
      updatedAt: now(),
      events: [
        ...state.events,
        {
          type: 'turn_advanced',
          timestamp: now(),
          playerId: state.turn.currentPlayerId,
          details: {
            nextPlayerId: nextPlayer?.id ?? state.turn.currentPlayerId,
            reason: 'skip_missing_player',
          },
        },
      ],
    })
  }

  const finishedPlayers = new Set(getFinishOrderFromEvents(state.events))
  if (finishedPlayers.has(state.turn.currentPlayerId)) {
    const nextPlayerIndex = getNextPlayerIndex(state, false)
    const nextPlayer = state.players[nextPlayerIndex] ?? state.players[0]

    return syncCurrentPlayerIndex({
      ...state,
      version: state.version + 1,
      currentPlayerIndex: nextPlayerIndex,
      turn: {
        id: makeTurnId(state),
        currentPlayerId: nextPlayer?.id ?? state.turn.currentPlayerId,
        diceResult: null,
        phase: 'waiting_roll',
        legalMoves: [],
        startTime: now(),
      },
      phase: 'waiting_roll',
      updatedAt: now(),
      events: [
        ...state.events,
        {
          type: 'turn_advanced',
          timestamp: now(),
          playerId: state.turn.currentPlayerId,
          details: {
            nextPlayerId: nextPlayer?.id ?? state.turn.currentPlayerId,
            reason: 'skip_finished_player',
          },
        },
      ],
    })
  }

  const diceResult = rollFn()
  const legalMoves = computeLegalMoves(state, diceResult)
  const timestamp = now()
  const shouldAutoSpawn = shouldAutoSpawnWithoutChoice(diceResult, legalMoves)
  const phase = legalMoves.length > 1 && !shouldAutoSpawn ? 'waiting_choice' : 'rolled'

  return syncCurrentPlayerIndex({
    ...state,
    version: state.version + 1,
    turn: {
      id: makeTurnId(state),
      currentPlayerId: state.turn.currentPlayerId,
      diceResult,
      phase,
      legalMoves,
      startTime: timestamp,
    },
    phase,
    updatedAt: timestamp,
    events: [
      ...state.events,
      {
        type: 'dice_roll',
        timestamp,
        playerId: state.turn.currentPlayerId,
        details: { result: diceResult },
      },
    ],
  })
}

export function resolveTurn(state: GameState, moveId?: string) {
  if (state.turn.diceResult === null || (state.turn.phase !== 'rolled' && state.turn.phase !== 'waiting_choice')) {
    return state
  }

  const diceResult = state.turn.diceResult
  const legalMoves = state.turn.legalMoves.length > 0 ? state.turn.legalMoves : computeLegalMoves(state, diceResult)
  const chosenMove = moveId ? legalMoves.find((move) => move.id === moveId) ?? null : legalMoves[0] ?? null
  const timestamp = now()

  if (state.turn.phase === 'waiting_choice' && legalMoves.length > 1 && !chosenMove) {
    return state
  }

  if (!chosenMove) {
    const finishData = appendFinishEvents(state, state.tokens, timestamp)
    const finishedByRank = new Set(finishData.finishOrder)
    const shouldEndGame = shouldEndGameByFinishCount(
      state.players.length,
      finishData.finishOrder.length,
    )

    if (shouldEndGame) {
    return syncCurrentPlayerIndex({
      ...state,
      version: state.version + 1,
      status: 'finished',
      winnerId: finishData.finishOrder[0],
      turn: {
        id: makeTurnId(state),
        currentPlayerId: state.turn.currentPlayerId,
        diceResult: null,
        phase: 'turn_end',
        legalMoves: [],
        startTime: timestamp,
      },
      phase: 'turn_end',
      updatedAt: timestamp,
      events: [
        ...finishData.events,
        {
          type: 'turn_advanced',
          timestamp,
          playerId: state.turn.currentPlayerId,
          details: {
            nextPlayerId: state.turn.currentPlayerId,
            reason: 'game_finished',
          },
        },
      ],
    })
    }

    const keepCurrentPlayer = diceResult === 6
    const nextPlayerIndex = keepCurrentPlayer && !finishedByRank.has(state.turn.currentPlayerId)
      ? state.currentPlayerIndex
      : getNextPlayerIndex(
          {
            ...state,
            events: finishData.events,
          },
          false,
        )
    const nextPlayer = state.players[nextPlayerIndex] ?? state.players[0]

    return syncCurrentPlayerIndex({
      ...state,
      version: state.version + 1,
      currentPlayerIndex: nextPlayerIndex,
      turn: {
        id: makeTurnId(state),
        currentPlayerId: nextPlayer?.id ?? state.turn.currentPlayerId,
        diceResult: null,
        phase: 'waiting_roll',
        legalMoves: [],
        startTime: timestamp,
      },
      phase: 'waiting_roll',
      updatedAt: timestamp,
      events: [
        ...finishData.events,
        {
          type: 'turn_advanced',
          timestamp,
          playerId: state.turn.currentPlayerId,
          details: {
            nextPlayerId: nextPlayer?.id ?? state.turn.currentPlayerId,
            reason: 'no_legal_move',
          },
        },
      ],
    })
  }

  const moveToken = state.tokens.find((token) => token.id === chosenMove.tokenId)
  if (!moveToken) {
    return state
  }

  const pathInfo = tokenPathFromMove(moveToken, diceResult)
  if (!pathInfo) {
    return state
  }

  const updatedTokens = state.tokens.map((token) => {
    if (token.id === moveToken.id) {
      return applyPathToToken(token, pathInfo.path)
    }

    return token
  })

  const captureCandidate =
    pathInfo.to.state === 'on_track'
      ? state.tokens.find((candidate) => {
          if (candidate.playerId === moveToken.playerId || candidate.state !== 'on_track') {
            return false
          }

          const moverSlot = boardSlotForPlayer(state, moveToken.playerId)
          const destinationAbsoluteTrack = absoluteTrackIndexFor(moverSlot, pathInfo.to.position)
          const candidateSlot = boardSlotForPlayer(state, candidate.playerId)
          if (candidateSlot < 0) {
            return false
          }

          return absoluteTrackIndexFor(candidateSlot, candidate.position) === destinationAbsoluteTrack
        })
      : null

  if (captureCandidate) {
    const captureSlot = baseSlotForToken(captureCandidate.id)
    for (let index = 0; index < updatedTokens.length; index += 1) {
      const token = updatedTokens[index]
      if (token.id === captureCandidate.id) {
        updatedTokens[index] = {
          ...token,
          state: 'in_base',
          position: captureSlot,
        }
      }
    }
  }

  const keepCurrentPlayer = diceResult === 6
  const nextPlayerIndex = getNextPlayerIndex(state, keepCurrentPlayer)
  const nextPlayer = state.players[nextPlayerIndex] ?? state.players[0]

  const events: GameEvent[] = [...state.events]
  events.push({
    type: 'token_moved',
    timestamp,
    playerId: moveToken.playerId,
    details: {
      tokenId: moveToken.id,
      moveType: chosenMove.moveType,
      from: pathInfo.from,
      to: pathInfo.to,
      path: pathInfo.path,
      capturedTokenId: captureCandidate?.id,
    },
  })

  if (captureCandidate) {
    events.push({
      type: 'token_captured',
      timestamp,
      playerId: moveToken.playerId,
      details: {
        tokenId: moveToken.id,
        playerId: moveToken.playerId,
        capturedTokenId: captureCandidate.id,
        from: pathInfo.to,
        to: {
          state: 'in_base',
          position: baseSlotForToken(captureCandidate.id),
        },
      },
    })
  }

  events.push({
    type: 'turn_advanced',
    timestamp,
    playerId: moveToken.playerId,
    details: {
      nextPlayerId: nextPlayer?.id ?? moveToken.playerId,
      reason: keepCurrentPlayer ? 'extra_turn' : 'normal_turn',
    },
  })

  const finishData = appendFinishEvents(
    {
      ...state,
      events,
    },
    updatedTokens,
    timestamp,
    moveToken.playerId,
  )

  const shouldEndGame = shouldEndGameByFinishCount(
    state.players.length,
    finishData.finishOrder.length,
  )
  if (shouldEndGame) {
    return syncCurrentPlayerIndex({
      ...state,
      version: state.version + 1,
      currentPlayerIndex: nextPlayerIndex,
      tokens: updatedTokens,
      status: 'finished',
      winnerId: finishData.finishOrder[0],
      turn: {
        id: makeTurnId(state),
        currentPlayerId: nextPlayer?.id ?? moveToken.playerId,
        diceResult: null,
        phase: 'turn_end',
        legalMoves: [],
        startTime: timestamp,
      },
      phase: 'turn_end',
      updatedAt: timestamp,
      events: finishData.events,
    })
  }

  const finishedByRank = new Set(finishData.finishOrder)
  const resolvedNextPlayerIndex = keepCurrentPlayer && !finishedByRank.has(moveToken.playerId)
    ? state.currentPlayerIndex
    : getNextPlayerIndex(
        {
          ...state,
          currentPlayerIndex: state.currentPlayerIndex,
          events: finishData.events,
        },
        false,
      )
  const resolvedNextPlayer = state.players[resolvedNextPlayerIndex] ?? state.players[0]

  return syncCurrentPlayerIndex({
    ...state,
    version: state.version + 1,
    currentPlayerIndex: resolvedNextPlayerIndex,
    tokens: updatedTokens,
    turn: {
      id: makeTurnId(state),
      currentPlayerId: resolvedNextPlayer?.id ?? moveToken.playerId,
      diceResult: null,
      phase: 'waiting_roll',
      legalMoves: [],
      startTime: timestamp,
    },
    phase: 'waiting_roll',
    updatedAt: timestamp,
    events: finishData.events,
  })
}
