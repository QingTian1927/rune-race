import { useCallback, useEffect, useRef, useState } from 'react'
import {
  computeLeaderboardAt,
  type ComputedPlayerState,
} from '../lib/fakeLeaderboardCompute'
import { PINNED_TOP_PLAYER_IDS } from '../lib/fakeLeaderboardSeed'

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

const POLL_MS = 8_000
const DELTA_FADE_MS = 5_200
const PINNED_SET = new Set<string>(PINNED_TOP_PLAYER_IDS)

function toRows(
  players: ComputedPlayerState[],
  prevRanks: Map<string, number>,
  scoreDeltas: Map<string, number>,
): LeaderboardRow[] {
  return players.map((player, index) => {
    const rank = index + 1
    const prevRank = prevRanks.get(player.seed.id)
    const isPinned = PINNED_SET.has(player.seed.id)
    const rankDelta =
      isPinned || prevRank == null ? null : prevRank - rank !== 0 ? prevRank - rank : null
    const rawDelta = scoreDeltas.get(player.seed.id)
    const scoreDelta = rawDelta != null && rawDelta !== 0 ? rawDelta : null

    return {
      id: player.seed.id,
      name: player.seed.name,
      emoji: player.seed.emoji,
      score: player.score,
      coins: player.coins,
      rank,
      scoreDelta,
      rankDelta: rankDelta !== 0 ? rankDelta : null,
    }
  })
}

function diffPlayers(
  prev: ComputedPlayerState[],
  curr: ComputedPlayerState[],
): Map<string, number> {
  const deltas = new Map<string, number>()
  const prevById = new Map(prev.map((player) => [player.seed.id, player]))

  for (const player of curr) {
    const before = prevById.get(player.seed.id)
    if (!before) continue
    const delta = player.score - before.score
    if (delta !== 0) deltas.set(player.seed.id, delta)
  }

  return deltas
}

export function useFakeLeaderboardSimulation() {
  const now = Date.now()
  const [rows, setRows] = useState<LeaderboardRow[]>(() => {
    const snapshot = computeLeaderboardAt(now)
    return toRows(snapshot, new Map(), new Map())
  })
  const [lastUpdated, setLastUpdated] = useState(() => new Date(now))
  const [revision, setRevision] = useState(0)

  const prevSnapshotRef = useRef<ComputedPlayerState[]>(computeLeaderboardAt(now - POLL_MS))
  const ranksRef = useRef<Map<string, number>>(new Map())
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applySnapshot = useCallback((snapshot: ComputedPlayerState[], atMs: number) => {
    const scoreDeltas = diffPlayers(prevSnapshotRef.current, snapshot)
    const nextRows = toRows(snapshot, ranksRef.current, scoreDeltas)

    ranksRef.current = new Map(nextRows.map((row) => [row.id, row.rank]))
    prevSnapshotRef.current = snapshot

    setRows(nextRows)
    setLastUpdated(new Date(atMs))
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
  }, [])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'hidden') return
      const atMs = Date.now()
      applySnapshot(computeLeaderboardAt(atMs), atMs)
    }

    tick()

    const interval = setInterval(tick, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [applySnapshot])

  return { rows, lastUpdated, revision }
}
