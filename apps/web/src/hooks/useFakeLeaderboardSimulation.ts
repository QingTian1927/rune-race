import { useCallback, useEffect, useRef, useState } from 'react'
import {
  resolveInitialPlayers,
  savePersistedLeaderboard,
  sortStoredPlayers,
  type StoredPlayerState,
} from '../lib/fakeLeaderboardStorage'
import { createRng, hashString, pickOne, randomFloat, randomInt } from '../lib/fakeLeaderboardRng'

export type LeaderboardRow = {
  id: string
  name: string
  emoji: string
  score: number
  coins: number
  rank: number
  scoreDelta: number | null
  rankDelta: number | null
}

type PlayerState = StoredPlayerState

const SCORE_TICK_MS = 8_000
const SHUFFLE_MIN_MS = 18_000
const SHUFFLE_MAX_MS = 42_000
const DELTA_FADE_MS = 5_200
const INITIAL_SHUFFLE_MS = 4_000

function toRows(
  players: PlayerState[],
  prevRanks: Map<string, number>,
  scoreDeltas: Map<string, number>,
): LeaderboardRow[] {
  return players.map((player, index) => {
    const rank = index + 1
    const prevRank = prevRanks.get(player.seed.id)
    const rankDelta = prevRank != null ? prevRank - rank : null
    const scoreDelta = scoreDeltas.get(player.seed.id) ?? null

    return {
      id: player.seed.id,
      name: player.seed.name,
      emoji: player.seed.emoji,
      score: player.score,
      coins: player.coins,
      rank,
      scoreDelta: scoreDelta !== 0 ? scoreDelta : null,
      rankDelta: rankDelta !== 0 ? rankDelta : null,
    }
  })
}

function pickUniqueIndices(rng: () => number, count: number, max: number): Set<number> {
  const picks = new Set<number>()
  while (picks.size < count) {
    picks.add(randomInt(rng, 0, max))
  }
  return picks
}

function applyScoreTick(players: PlayerState[], rng: () => number): { players: PlayerState[]; deltas: Map<string, number> } {
  const deltas = new Map<string, number>()
  const activeIndices = pickUniqueIndices(rng, randomInt(rng, 6, 10), players.length - 1)

  const next = players.map((player, index) => {
    let delta = 0
    let coinDelta = 0

    if (activeIndices.has(index)) {
      if (rng() < 0.14) {
        delta = randomInt(rng, -18, -4)
        coinDelta = randomInt(rng, -2, 0)
      } else {
        delta = randomInt(rng, 10, 36)
        coinDelta = randomInt(rng, 0, 5)
      }
    } else if (rng() < 0.35) {
      delta = randomInt(rng, -5, 6)
      coinDelta = randomInt(rng, -1, 2)
    } else {
      const drift = player.seed.scoreDriftPerMin * randomFloat(rng, 1.5, 4.5)
      delta = Math.round(drift + randomInt(rng, -2, 3))
      if (delta !== 0) coinDelta = randomInt(rng, -1, 1)
    }

    if (delta !== 0) deltas.set(player.seed.id, delta)

    return {
      ...player,
      score: Math.max(120, player.score + delta),
      coins: Math.max(80, player.coins + coinDelta),
    }
  })

  return { players: next, deltas }
}

function applyOvertake(next: PlayerState[], rng: () => number, deltas: Map<string, number>) {
  const fromRank = randomInt(rng, 1, Math.min(14, next.length - 1))
  const passes = randomInt(rng, 1, Math.min(2, fromRank))
  const target = next[fromRank]!
  const blocker = next[fromRank - passes]!
  const boost = blocker.score - target.score + randomInt(rng, 8, 35)
  target.score += boost
  deltas.set(target.seed.id, boost)
}

function applyShuffleEvent(players: PlayerState[], rng: () => number): { players: PlayerState[]; deltas: Map<string, number> } {
  const deltas = new Map<string, number>()
  const sorted = sortStoredPlayers(players)
  const event = pickOne(rng, [
    'overtake',
    'overtake',
    'comeback',
    'swap_pair',
    'midfield_scramble',
    'top_scuffle',
  ] as const)

  const next = sorted.map((p) => ({ ...p }))

  if (event === 'overtake') {
    applyOvertake(next, rng, deltas)
  } else if (event === 'comeback') {
    const from = randomInt(rng, 6, Math.min(16, next.length - 1))
    const target = next[from]!
    const passes = randomInt(rng, 2, 4)
    const blocker = next[Math.max(0, from - passes)]!
    const boost = blocker.score - target.score + randomInt(rng, 12, 40)
    target.score += boost
    deltas.set(target.seed.id, boost)
  } else if (event === 'swap_pair') {
    const a = randomInt(rng, 0, next.length - 2)
    const b = Math.min(a + randomInt(rng, 1, 4), next.length - 1)
    const playerA = next[a]!
    const playerB = next[b]!
    const scoreA = playerA.score
    const scoreB = playerB.score
    const gap = Math.abs(scoreA - scoreB)
    const cross = gap + randomInt(rng, 6, 28)
    if (scoreA >= scoreB) {
      playerB.score = scoreA + cross
      playerA.score = scoreB - randomInt(rng, 2, 12)
    } else {
      playerA.score = scoreB + cross
      playerB.score = scoreA - randomInt(rng, 2, 12)
    }
    deltas.set(playerA.seed.id, playerA.score - scoreA)
    deltas.set(playerB.seed.id, playerB.score - scoreB)
  } else if (event === 'top_scuffle') {
    const headCount = randomInt(rng, 4, 6)
    for (let i = 0; i < headCount; i += 1) {
      const player = next[i]!
      const boost = randomInt(rng, 14, 48)
      player.score += boost
      deltas.set(player.seed.id, boost)
    }
  } else {
    const picks = pickUniqueIndices(rng, randomInt(rng, 4, 6), next.length - 1)
    for (const idx of picks) {
      if (idx < 2) continue
      const player = next[idx]!
      const boost = randomInt(rng, 18, 42)
      player.score += boost
      deltas.set(player.seed.id, boost)
    }
  }

  return { players: next, deltas }
}

function initPlayers(): PlayerState[] {
  return sortStoredPlayers(resolveInitialPlayers(Date.now()))
}

export function useFakeLeaderboardSimulation() {
  const [rows, setRows] = useState<LeaderboardRow[]>(() => {
    const bootstrapped = initPlayers()
    return toRows(bootstrapped, new Map(), new Map())
  })
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [revision, setRevision] = useState(0)

  const playersRef = useRef<PlayerState[]>([])
  const ranksRef = useRef<Map<string, number>>(new Map())
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialShuffleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistPlayers = useCallback((players: PlayerState[]) => {
    savePersistedLeaderboard(players, Date.now())
  }, [])

  const commit = useCallback(
    (players: PlayerState[], scoreDeltas: Map<string, number>) => {
      const sorted = sortStoredPlayers(players)
      playersRef.current = sorted
      persistPlayers(sorted)

      const nextRows = toRows(sorted, ranksRef.current, scoreDeltas)
      ranksRef.current = new Map(nextRows.map((row) => [row.id, row.rank]))
      setRows(nextRows)
      setLastUpdated(new Date())
      setRevision((value) => value + 1)

      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = setTimeout(() => {
        setRows((current) =>
          current.map((row) => ({
            ...row,
            scoreDelta: null,
            rankDelta: null,
          })),
        )
      }, DELTA_FADE_MS)
    },
    [persistPlayers],
  )

  const runShuffle = useCallback(() => {
    if (document.visibilityState === 'hidden') return
    const rng = createRng(hashString(`shuffle-${Date.now()}`))
    const { players, deltas } = applyShuffleEvent(playersRef.current, rng)
    commit(players, deltas)
  }, [commit])

  useEffect(() => {
    const bootstrapped = initPlayers()
    playersRef.current = bootstrapped
    ranksRef.current = new Map(bootstrapped.map((p, i) => [p.seed.id, i + 1]))
    persistPlayers(bootstrapped)

    const scoreInterval = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      const rng = createRng(hashString(`tick-${Date.now()}`))
      const { players, deltas } = applyScoreTick(playersRef.current, rng)
      commit(players, deltas)

      if (rng() < 0.22) {
        runShuffle()
      }
    }, SCORE_TICK_MS)

    initialShuffleRef.current = setTimeout(runShuffle, INITIAL_SHUFFLE_MS)

    const scheduleShuffle = () => {
      const delay = randomInt(createRng(Date.now()), SHUFFLE_MIN_MS, SHUFFLE_MAX_MS)
      shuffleTimerRef.current = setTimeout(() => {
        runShuffle()
        scheduleShuffle()
      }, delay)
    }

    scheduleShuffle()

    const onPageHide = () => {
      persistPlayers(playersRef.current)
    }
    window.addEventListener('pagehide', onPageHide)

    return () => {
      clearInterval(scoreInterval)
      if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current)
      if (initialShuffleRef.current) clearTimeout(initialShuffleRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      window.removeEventListener('pagehide', onPageHide)
      persistPlayers(playersRef.current)
    }
  }, [commit, persistPlayers, runShuffle])

  return { rows, lastUpdated, revision }
}
