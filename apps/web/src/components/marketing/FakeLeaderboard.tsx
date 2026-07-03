import { useEffect, useState, type CSSProperties } from 'react'
import { useFakeLeaderboardSimulation, type LeaderboardRow } from '../../hooks/useFakeLeaderboardSimulation'
import { useRankFlash, useValueFlash } from '../../hooks/useValueFlash'

const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function rowMotionClass(row: LeaderboardRow): string {
  if (row.rankDelta == null || row.rankDelta === 0) return ''
  return row.rankDelta > 0 ? ' leaderboard-row--moved-up' : ' leaderboard-row--moved-down'
}

function rowMotionStyle(row: LeaderboardRow): CSSProperties | undefined {
  if (row.rankDelta == null || row.rankDelta === 0) return undefined
  return { '--rank-shift': Math.min(Math.abs(row.rankDelta), 4) } as CSSProperties
}

function RankCell({ row, revision }: { row: LeaderboardRow; revision: number }) {
  const medal = RANK_MEDALS[row.rank]
  const rankFlash = useRankFlash(row.rank)

  return (
    <span className="leaderboard-rank">
      {medal ? <span className="leaderboard-rank-medal">{medal}</span> : null}
      <span
        className={`leaderboard-rank-num${
          rankFlash ? ` leaderboard-rank-num--flash-${rankFlash}` : ''
        }`}
      >
        {row.rank}
      </span>
      {row.rankDelta != null ? (
        <span
          key={`${row.id}-rank-${revision}`}
          className={`leaderboard-rank-delta leaderboard-delta-badge${
            row.rankDelta > 0 ? ' up' : row.rankDelta < 0 ? ' down' : ''
          }`}
          aria-label={row.rankDelta > 0 ? `Lên ${row.rankDelta} hạng` : `Tụt ${Math.abs(row.rankDelta)} hạng`}
        >
          {row.rankDelta > 0 ? `▲${row.rankDelta}` : `▼${Math.abs(row.rankDelta)}`}
        </span>
      ) : null}
    </span>
  )
}

function ScoreCell({ row, revision }: { row: LeaderboardRow; revision: number }) {
  const scoreFlash = useValueFlash(row.score)

  return (
    <span className="leaderboard-score">
      <span
        className={`leaderboard-score-value${
          scoreFlash ? ` leaderboard-score-value--flash-${scoreFlash}` : ''
        }`}
      >
        {row.score.toLocaleString('vi-VN')}
      </span>
      {row.scoreDelta != null ? (
        <span
          key={`${row.id}-score-${revision}`}
          className={`leaderboard-score-delta leaderboard-delta-badge${
            row.scoreDelta >= 0 ? ' up' : ' down'
          }`}
        >
          {row.scoreDelta >= 0 ? `+${row.scoreDelta}` : row.scoreDelta}
        </span>
      ) : null}
    </span>
  )
}

function CoinsCell({ coins }: { coins: number }) {
  const coinFlash = useValueFlash(coins)

  return (
    <span
      className={`leaderboard-coins${
        coinFlash ? ` leaderboard-coins--flash-${coinFlash}` : ''
      }`}
    >
      {coins.toLocaleString('vi-VN')} 🪙
    </span>
  )
}

function PlayerCell({ row }: { row: LeaderboardRow }) {
  return (
    <span className="leaderboard-player">
      <span className="leaderboard-avatar" aria-hidden="true">
        {row.emoji}
      </span>
      <span className="leaderboard-name">{row.name}</span>
    </span>
  )
}

function LeaderboardTable({ rows, revision }: { rows: LeaderboardRow[]; revision: number }) {
  return (
    <div className="table-wrap leaderboard-table-wrap">
      <table className="leaderboard-table" aria-label="Bảng xếp hạng">
        <thead>
          <tr>
            <th scope="col">Hạng</th>
            <th scope="col">Người chơi</th>
            <th scope="col">Điểm</th>
            <th scope="col">Xu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              style={rowMotionStyle(row)}
              className={`leaderboard-row${row.rank <= 3 ? ` leaderboard-row--top${row.rank}` : ''}${rowMotionClass(row)}`}
            >
              <td>
                <RankCell row={row} revision={revision} />
              </td>
              <td>
                <PlayerCell row={row} />
              </td>
              <td>
                <ScoreCell row={row} revision={revision} />
              </td>
              <td>
                <CoinsCell coins={row.coins} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LeaderboardCards({ rows, revision }: { rows: LeaderboardRow[]; revision: number }) {
  return (
    <div className="leaderboard-cards" aria-label="Bảng xếp hạng">
      {rows.map((row) => (
        <article
          key={row.id}
          style={rowMotionStyle(row)}
          className={`leaderboard-card surface${row.rank <= 3 ? ` leaderboard-card--top${row.rank}` : ''}${rowMotionClass(row)}`}
        >
          <div className="leaderboard-card-head">
            <RankCell row={row} revision={revision} />
            <PlayerCell row={row} />
          </div>
          <div className="leaderboard-card-stats">
            <div>
              <span className="leaderboard-card-label">Điểm</span>
              <ScoreCell row={row} revision={revision} />
            </div>
            <div>
              <span className="leaderboard-card-label">Xu</span>
              <CoinsCell coins={row.coins} />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

export function FakeLeaderboard() {
  const { rows, lastUpdated, revision } = useFakeLeaderboardSimulation()
  const [metaPulse, setMetaPulse] = useState(false)

  useEffect(() => {
    if (revision === 0) return
    setMetaPulse(true)
    const timer = window.setTimeout(() => setMetaPulse(false), 620)
    return () => window.clearTimeout(timer)
  }, [revision, lastUpdated])

  return (
    <div className="leaderboard-shell">
      <div className="leaderboard-meta">
        <span>
          <i className="bi bi-trophy-fill" aria-hidden="true" /> Bảng xếp hạng trực tiếp
        </span>
        <span className={`leaderboard-meta-updated${metaPulse ? ' leaderboard-meta-updated--pulse' : ''}`}>
          <i className="bi bi-arrow-repeat" aria-hidden="true" /> Cập nhật lúc {formatUpdatedAt(lastUpdated)}
        </span>
      </div>
      <LeaderboardTable rows={rows} revision={revision} />
      <LeaderboardCards rows={rows} revision={revision} />
    </div>
  )
}
