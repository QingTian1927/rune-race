import {
  FAKE_LEADERBOARD_SEED,
  LEADERBOARD_EPOCH_START_MS,
  PINNED_TOP_PLAYER_IDS,
  type FakeLeaderboardSeedEntry,
} from './fakeLeaderboardSeed'
import { createRng, hashString, randomInt } from './fakeLeaderboardRng'

/** Score/coin noise window — all clients share the same UTC bucket. */
export const LEADERBOARD_FLUX_MS = 15_000

/** Smaller tick for livelier micro-movement between flux windows. */
export const LEADERBOARD_MICRO_MS = 8_000

export type ComputedPlayerState = {
  seed: FakeLeaderboardSeedEntry
  score: number
  coins: number
}

const PINNED_SET = new Set<string>(PINNED_TOP_PLAYER_IDS)
const PINNED_SCORE_GAP = 12

function minutesSinceEpoch(nowMs: number): number {
  return Math.max(0, (nowMs - LEADERBOARD_EPOCH_START_MS) / 60_000)
}

function fluxIndex(nowMs: number): number {
  return Math.floor((nowMs - LEADERBOARD_EPOCH_START_MS) / LEADERBOARD_FLUX_MS)
}

function microIndex(nowMs: number): number {
  return Math.floor(nowMs / LEADERBOARD_MICRO_MS)
}

/** Deterministic burst so ranks 4–20 shuffle often; resets each flux window. */
function eventSway(playerId: string, fi: number): number {
  const global = createRng(hashString(`ev-global-${fi}`))
  const roll = global()

  if (PINNED_SET.has(playerId)) {
    const pinnedRng = createRng(hashString(`${playerId}-ev-pinned-${fi}`))
    return roll > 0.4 ? randomInt(pinnedRng, 4, 18) : 0
  }

  if (roll > 0.82) {
    const rng = createRng(hashString(`${playerId}-ev-scramble-${fi}`))
    return rng() < 0.5 ? randomInt(rng, 22, 52) : 0
  }
  if (roll > 0.52) {
    const rng = createRng(hashString(`${playerId}-ev-active-${fi}`))
    return rng() < 0.38 ? randomInt(rng, 14, 38) : 0
  }
  if (roll > 0.28) {
    const rng = createRng(hashString(`${playerId}-ev-light-${fi}`))
    return rng() < 0.28 ? randomInt(rng, 8, 22) : 0
  }

  const rng = createRng(hashString(`${playerId}-ev-dip-${fi}`))
  return rng() < 0.12 ? randomInt(rng, -14, -4) : 0
}

function computePlayerAt(seed: FakeLeaderboardSeedEntry, nowMs: number): ComputedPlayerState {
  const minutes = minutesSinceEpoch(nowMs)
  const fi = fluxIndex(nowMs)
  const mi = microIndex(nowMs)

  const trendScore = seed.baseScore + seed.scoreDriftPerMin * minutes
  const trendCoins = seed.baseCoins + seed.coinDriftPerMin * minutes

  const fluxRng = createRng(hashString(`${seed.id}-flux-${fi}`))
  const microRng = createRng(hashString(`${seed.id}-micro-${mi}`))
  const fluxCoinRng = createRng(hashString(`${seed.id}-coin-flux-${fi}`))
  const microCoinRng = createRng(hashString(`${seed.id}-coin-micro-${mi}`))

  const score =
    trendScore +
    randomInt(fluxRng, -16, 20) +
    randomInt(microRng, -6, 11) +
    eventSway(seed.id, fi)

  const coins =
    trendCoins + randomInt(fluxCoinRng, -2, 4) + randomInt(microCoinRng, -1, 3)

  return {
    seed,
    score: Math.max(120, Math.round(score)),
    coins: Math.max(80, Math.round(coins)),
  }
}

function enforcePinnedScoreOrder(players: ComputedPlayerState[]): ComputedPlayerState[] {
  const next = players.map((player) => ({ ...player }))
  const byId = new Map(next.map((player) => [player.seed.id, player]))

  const first = byId.get('p01')
  const second = byId.get('p02')
  const third = byId.get('p03')
  if (!first || !second || !third) return next

  const restScores = next.filter((player) => !PINNED_SET.has(player.seed.id)).map((player) => player.score)
  const maxRest = restScores.length > 0 ? Math.max(...restScores) : 120

  third.score = Math.max(third.score, maxRest + PINNED_SCORE_GAP)
  second.score = Math.max(second.score, third.score + PINNED_SCORE_GAP)
  first.score = Math.max(first.score, second.score + PINNED_SCORE_GAP)

  return next
}

function sortPlayers(players: ComputedPlayerState[]): ComputedPlayerState[] {
  const byId = new Map(players.map((player) => [player.seed.id, player]))
  const pinned = PINNED_TOP_PLAYER_IDS.map((id) => byId.get(id)).filter(
    (player): player is ComputedPlayerState => player != null,
  )
  const rest = players
    .filter((player) => !PINNED_SET.has(player.seed.id))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.seed.name.localeCompare(b.seed.name, 'vi')
    })

  return [...pinned, ...rest]
}

/** Pure UTC clock — identical output for every client at the same `nowMs`. */
export function computeLeaderboardAt(nowMs: number): ComputedPlayerState[] {
  const players = FAKE_LEADERBOARD_SEED.map((seed) => computePlayerAt(seed, nowMs))
  return sortPlayers(enforcePinnedScoreOrder(players))
}

export function fluxBucketStartMs(nowMs: number): number {
  return LEADERBOARD_EPOCH_START_MS + fluxIndex(nowMs) * LEADERBOARD_FLUX_MS
}
