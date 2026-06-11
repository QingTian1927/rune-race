import { describe, expect, it } from 'vitest'
import type { GameEvent, GameState, Player } from '@rune-race/shared'
import {
  absoluteTrackIndexFor,
  boardSlotForPlayer,
  createInitialGameState,
  handleChooseMove,
  handleChooseSwap,
  handleConfirmDraw,
  handleConfirmPlacementReady,
  handleDrawCards,
  handleFinishDraw,
  handlePlaceMarker,
  handleRoll,
  handleSelectHonestyReward,
  handleUseLeaveStable,
  tickPlacementPhase,
  type GameCommandResult,
} from '@rune-race/game-engine'
import { decideNextAction } from './decide.js'
import type { BotAction, BotProfile } from './types.js'

/**
 * Fuzz hunt for the "ghost piece" bug: simulate full bot-vs-bot rune games
 * through the same command handlers the server uses, and after EVERY command
 * assert that no token can be invisible/duplicated/stuck on the track.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PLAYERS: Player[] = [
  { id: 'p-red', name: 'Red', color: 'red' },
  { id: 'p-blue', name: 'Blue', color: 'blue' },
  { id: 'p-green', name: 'Green', color: 'green' },
  { id: 'p-yellow', name: 'Yellow', color: 'yellow' },
]

function baseSlotForToken(tokenId: string): number {
  const match = tokenId.match(/:(\d+)$/)
  return match ? Number(match[1]) : 0
}

type Violation = {
  message: string
  command: string
  state: GameState
  deltaEvents: GameEvent[]
}

function describeToken(t: GameState['tokens'][number]): string {
  return `${t.id}[${t.state}@${t.position}${(t.freezeTurnsRemaining ?? 0) > 0 ? ',frozen' : ''}]`
}

/** Core invariants. Returns a list of violation messages (empty = OK). */
function checkInvariants(
  before: GameState,
  after: GameState,
  deltaEvents: GameEvent[],
): string[] {
  const problems: string[] = []

  // 1. Token conservation: same token ids before/after.
  const beforeIds = new Set(before.tokens.map((t) => t.id))
  const afterIds = new Set(after.tokens.map((t) => t.id))
  if (beforeIds.size !== afterIds.size || ![...beforeIds].every((id) => afterIds.has(id))) {
    problems.push(
      `token set changed: before=[${[...beforeIds].join(',')}] after=[${[...afterIds].join(',')}]`,
    )
  }

  // 2. No two on_track tokens may share an absolute main-track cell.
  const byAbsoluteCell = new Map<number, string[]>()
  for (const token of after.tokens) {
    if (token.state !== 'on_track') continue
    const slot = boardSlotForPlayer(after, token.playerId)
    if (slot < 0) {
      problems.push(`token ${token.id} on_track but player has no board slot`)
      continue
    }
    const absolute = absoluteTrackIndexFor(slot, token.position)
    const group = byAbsoluteCell.get(absolute) ?? []
    group.push(describeToken(token))
    byAbsoluteCell.set(absolute, group)
  }
  for (const [cell, tokens] of byAbsoluteCell) {
    if (tokens.length > 1) {
      problems.push(`OVERLAP: cell ${cell} occupied by ${tokens.join(' AND ')}`)
    }
  }

  // 3. Captured / sent-home tokens must actually be in_base afterwards
  //    (unless a later event in the same batch moved them again).
  const expectedInBase = new Map<string, string>()
  for (const event of deltaEvents) {
    if (event.type === 'token_captured') {
      const capturedId = String(event.details?.capturedTokenId ?? '')
      if (capturedId) expectedInBase.set(capturedId, 'token_captured')
    } else if (
      event.type === 'horse_status_changed' &&
      event.details?.status === 'sent_home'
    ) {
      const tokenId = String(event.details?.tokenId ?? '')
      if (tokenId) expectedInBase.set(tokenId, 'sent_home')
    } else if (event.type === 'token_moved' || event.type === 'token_stepped') {
      const tokenId = String(event.details?.tokenId ?? '')
      expectedInBase.delete(tokenId)
    } else if (event.type === 'token_swapped') {
      expectedInBase.delete(String(event.details?.activatorTokenId ?? ''))
      expectedInBase.delete(String(event.details?.targetTokenId ?? ''))
    }
  }
  for (const [tokenId, source] of expectedInBase) {
    const token = after.tokens.find((t) => t.id === tokenId)
    if (!token) {
      problems.push(`GHOST: ${source} for ${tokenId} but token does not exist`)
      continue
    }
    if (token.state !== 'in_base') {
      problems.push(
        `GHOST: ${source} for ${tokenId} but token is ${describeToken(token)} (should be in_base)`,
      )
    } else if (token.position !== baseSlotForToken(tokenId)) {
      problems.push(
        `BAD BASE SLOT: ${tokenId} in_base at slot ${token.position}, expected ${baseSlotForToken(tokenId)}`,
      )
    }
  }

  // 4. Every token position must be within board bounds for its state.
  for (const token of after.tokens) {
    if (token.state === 'on_track' && (token.position < 0 || token.position > 51)) {
      problems.push(`OUT OF RANGE: ${describeToken(token)}`)
    }
    if (token.state === 'in_home_lane' && (token.position < 0 || token.position > 5)) {
      problems.push(`OUT OF LANE RANGE: ${describeToken(token)}`)
    }
  }

  return problems
}

function executeAction(
  state: GameState,
  playerId: string,
  action: BotAction,
  rollFn: () => number,
): GameCommandResult {
  switch (action.type) {
    case 'roll':
      return handleRoll(state, playerId, rollFn)
    case 'choose_move':
      return handleChooseMove(state, playerId, action.moveId)
    case 'choose_swap':
      return handleChooseSwap(state, playerId, action.targetTokenId)
    case 'draw_cards':
      return handleDrawCards(state, playerId, 1)
    case 'confirm_draw':
      return handleConfirmDraw(state, playerId)
    case 'finish_draw':
      return handleFinishDraw(state, playerId)
    case 'place_marker':
      return handlePlaceMarker(
        state,
        playerId,
        action.heldCardId,
        action.cellId,
        action.displayedIdentityId,
      )
    case 'confirm_placement_ready':
      return handleConfirmPlacementReady(state, playerId)
    case 'use_leave_stable':
      return handleUseLeaveStable(state, playerId, action.heldCardId)
    case 'select_honesty_reward':
      return handleSelectHonestyReward(state, playerId, action.cardType)
  }
}

interface GameRunStats {
  commands: number
  captures: number
  sentHomes: number
  markerTriggers: number
  swaps: number
  finished: boolean
}

function runOneGame(seed: number): { violations: Violation[]; stats: GameRunStats } {
  const rng = mulberry32(seed)
  const rollFn = () => 1 + Math.floor(rng() * 6)
  const profiles = new Map<string, BotProfile>(
    PLAYERS.map((p) => [p.id, rng() < 0.5 ? 'simple' : 'complex']),
  )

  let state = createInitialGameState({
    gameId: `fuzz-${seed}`,
    players: PLAYERS,
    firstPlayerId: PLAYERS[Math.floor(rng() * PLAYERS.length)]!.id,
    runesEnabled: true,
  })

  const violations: Violation[] = []
  const stats: GameRunStats = {
    commands: 0,
    captures: 0,
    sentHomes: 0,
    markerTriggers: 0,
    swaps: 0,
    finished: false,
  }

  let stuckPasses = 0
  const MAX_COMMANDS = 30_000

  while (state.status === 'playing' && stats.commands < MAX_COMMANDS && stuckPasses < 3) {
    let actedThisPass = false

    for (const player of state.players) {
      if (state.status !== 'playing') break
      const action = decideNextAction(
        { state, botPlayerId: player.id, profile: profiles.get(player.id)! },
        rng,
      )
      if (!action) continue

      const before = state
      const result = executeAction(state, player.id, action, rollFn)
      if (!result.success) {
        continue
      }

      state = result.state
      stats.commands += 1
      actedThisPass = true

      for (const event of result.events) {
        if (event.type === 'token_captured') stats.captures += 1
        if (event.type === 'token_swapped') stats.swaps += 1
        if (event.type === 'marker_triggered') stats.markerTriggers += 1
        if (event.type === 'horse_status_changed' && event.details?.status === 'sent_home') {
          stats.sentHomes += 1
        }
      }

      const problems = checkInvariants(before, state, result.events)
      for (const message of problems) {
        violations.push({
          message,
          command: `${player.id} -> ${action.type} (seed=${seed}, cmd#${stats.commands})`,
          state,
          deltaEvents: result.events,
        })
      }
      if (violations.length > 0) {
        return { violations, stats }
      }
    }

    if (!actedThisPass && state.turn.phase === 'placement_phase') {
      // Bots are all ready but the placement window has a real-time minimum.
      // The server closes it via an interval tick — simulate that tick here.
      const placement = state.rune?.placement
      const before = state
      const closed = tickPlacementPhase(state, (placement?.maxCloseAt ?? Date.now()) + 1)
      if (closed !== before) {
        state = closed
        const events = closed.events.slice(before.events.length)
        const problems = checkInvariants(before, state, events)
        for (const message of problems) {
          violations.push({
            message,
            command: `tickPlacementPhase (seed=${seed}, cmd#${stats.commands})`,
            state,
            deltaEvents: events,
          })
        }
        if (violations.length > 0) return { violations, stats }
        actedThisPass = true
      }
    }

    stuckPasses = actedThisPass ? 0 : stuckPasses + 1
  }

  stats.finished = state.status === 'finished'
  return { violations, stats }
}

describe('ghost piece fuzz', () => {
  it('simulates full bot games without breaking board invariants', () => {
    const GAMES = 200
    const totals: GameRunStats = {
      commands: 0,
      captures: 0,
      sentHomes: 0,
      markerTriggers: 0,
      swaps: 0,
      finished: false,
    }
    let finishedGames = 0

    for (let seed = 1; seed <= GAMES; seed += 1) {
      const { violations, stats } = runOneGame(seed)

      if (violations.length > 0) {
        const v = violations[0]!
        const tokenDump = v.state.tokens.map(describeToken).join('\n  ')
        const eventDump = v.deltaEvents
          .map((e) => `${e.type} ${JSON.stringify(e.details)}`)
          .join('\n  ')
        throw new Error(
          `Invariant violated: ${v.message}\nat command: ${v.command}\n` +
            `tokens:\n  ${tokenDump}\ndelta events:\n  ${eventDump}`,
        )
      }

      totals.commands += stats.commands
      totals.captures += stats.captures
      totals.sentHomes += stats.sentHomes
      totals.markerTriggers += stats.markerTriggers
      totals.swaps += stats.swaps
      if (stats.finished) finishedGames += 1
    }

    // Coverage sanity: the fuzz must actually exercise the suspicious mechanics.
    // eslint-disable-next-line no-console
    console.info(
      `[ghost-fuzz] games=${GAMES} finished=${finishedGames} commands=${totals.commands} ` +
        `captures=${totals.captures} sentHomes=${totals.sentHomes} ` +
        `markerTriggers=${totals.markerTriggers} swaps=${totals.swaps}`,
    )
    expect(totals.captures).toBeGreaterThan(0)
    expect(totals.markerTriggers).toBeGreaterThan(0)
    expect(finishedGames).toBeGreaterThan(0)
  }, 120_000)
})
