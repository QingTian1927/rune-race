import {
  FAKE_LEADERBOARD_SEED,
  LEADERBOARD_EPOCH_START_MS,
  type FakeLeaderboardSeedEntry,
} from './fakeLeaderboardSeed'
import { createRng, hashString, randomInt } from './fakeLeaderboardRng'

const STORAGE_KEY = 'rune-race-fake-leaderboard'
const STORAGE_VERSION = 1

export type PersistedPlayer = {
  score: number
  coins: number
}

export type PersistedLeaderboard = {
  v: typeof STORAGE_VERSION
  savedAt: number
  players: Record<string, PersistedPlayer>
}

export type StoredPlayerState = {
  seed: FakeLeaderboardSeedEntry
  score: number
  coins: number
}

function epochMinutes(now: number): number {
  return Math.max(0, (now - LEADERBOARD_EPOCH_START_MS) / 60_000)
}

function bootstrapPlayer(seed: FakeLeaderboardSeedEntry, now: number): StoredPlayerState {
  const rng = createRng(hashString(seed.id))
  const minutes = epochMinutes(now)
  const scoreJitter = randomInt(rng, -4, 4)
  const coinJitter = randomInt(rng, -3, 3)

  return {
    seed,
    score: Math.round(seed.baseScore + seed.scoreDriftPerMin * minutes + scoreJitter),
    coins: Math.max(80, Math.round(seed.baseCoins + seed.coinDriftPerMin * minutes + coinJitter)),
  }
}

function applyOfflineDrift(
  players: StoredPlayerState[],
  savedAt: number,
  now: number,
): StoredPlayerState[] {
  const elapsedMin = Math.max(0, (now - savedAt) / 60_000)
  if (elapsedMin < 0.25) return players

  const rng = createRng(hashString(`offline-${savedAt}-${now}`))
  const activityBursts = Math.min(120, Math.floor(elapsedMin * 1.8))

  return players.map((player) => {
    let score = player.score
    let coins = player.coins

    score += Math.round(player.seed.scoreDriftPerMin * elapsedMin)
    coins += Math.round(player.seed.coinDriftPerMin * elapsedMin)

    for (let i = 0; i < activityBursts; i += 1) {
      if (rng() < 0.38) {
        score += randomInt(rng, 4, 18)
        if (rng() < 0.55) coins += randomInt(rng, 0, 2)
      } else if (rng() < 0.1) {
        score -= randomInt(rng, 2, 8)
      }
    }

    return {
      ...player,
      score: Math.max(120, score),
      coins: Math.max(80, coins),
    }
  })
}

export function loadPersistedLeaderboard(): PersistedLeaderboard | null {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as PersistedLeaderboard
    if (parsed?.v !== STORAGE_VERSION || typeof parsed.savedAt !== 'number' || !parsed.players) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function savePersistedLeaderboard(players: StoredPlayerState[], now: number): void {
  if (typeof localStorage === 'undefined') return

  const payload: PersistedLeaderboard = {
    v: STORAGE_VERSION,
    savedAt: now,
    players: Object.fromEntries(
      players.map((player) => [player.seed.id, { score: player.score, coins: player.coins }]),
    ),
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Quota or private mode — simulation still runs in memory.
  }
}

/** Restore saved scores or bootstrap from epoch; apply growth while the tab was away. */
export function resolveInitialPlayers(now: number): StoredPlayerState[] {
  const persisted = loadPersistedLeaderboard()

  if (!persisted) {
    return FAKE_LEADERBOARD_SEED.map((seed) => bootstrapPlayer(seed, now))
  }

  const players = FAKE_LEADERBOARD_SEED.map((seed) => {
    const saved = persisted.players[seed.id]
    if (!saved) return bootstrapPlayer(seed, now)

    return {
      seed,
      score: saved.score,
      coins: saved.coins,
    }
  })

  return applyOfflineDrift(players, persisted.savedAt, now)
}

export function sortStoredPlayers(players: StoredPlayerState[]): StoredPlayerState[] {
  return [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.seed.name.localeCompare(b.seed.name, 'vi')
  })
}
