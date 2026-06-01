import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FeatureFlagsPanel } from '../components/FeatureFlagsPanel'
import { KpiCard } from '../components/KpiCard'
import { useAuth } from '../hooks/useAuth'
import { ApiError, fetchLive, fetchTimeseries, fetchTopPlayers } from '../lib/api'
import { formatDateTime, formatPlayTime, formatWinRate } from '../lib/format'

export default function DashboardPage() {
  const { accessToken } = useAuth()
  const token = accessToken!

  const liveQuery = useQuery({
    queryKey: ['admin', 'live'],
    queryFn: () => fetchLive(token),
    enabled: Boolean(accessToken),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const timeseriesQuery = useQuery({
    queryKey: ['admin', 'timeseries', 24],
    queryFn: () => fetchTimeseries(token, 24),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  })

  const topPlayersQuery = useQuery({
    queryKey: ['admin', 'top-players', 'playtime'],
    queryFn: () => fetchTopPlayers(token, 'playtime'),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  })

  const forbidden = [liveQuery, timeseriesQuery, topPlayersQuery].some(
    (q) => q.error instanceof ApiError && q.error.status === 403,
  )

  const peakPlayers = useMemo(() => {
    const points = timeseriesQuery.data ?? []
    if (points.length === 0) return 0
    return points.reduce((max, p) => Math.max(max, p.unique_players), 0)
  }, [timeseriesQuery.data])

  const totalPlaySeconds = useMemo(() => {
    return (timeseriesQuery.data ?? []).reduce((sum, p) => sum + p.total_play_seconds, 0)
  }, [timeseriesQuery.data])

  if (forbidden) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Không có quyền truy cập</h1>
        </header>
        <p className="alert alert-error">
          Tài khoản đã đăng nhập nhưng chưa nằm trong <code>ADMIN_USER_IDS</code> trên server.
        </p>
      </div>
    )
  }

  const anyError = liveQuery.error ?? timeseriesQuery.error ?? topPlayersQuery.error
  const isLoading = liveQuery.isLoading || timeseriesQuery.isLoading || topPlayersQuery.isLoading

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Tổng quan vận hành</h1>
          <p className="muted">Số liệu realtime và xu hướng 24 giờ gần nhất</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            void liveQuery.refetch()
            void timeseriesQuery.refetch()
            void topPlayersQuery.refetch()
          }}
        >
          Làm mới
        </button>
      </header>

      <FeatureFlagsPanel />

      {isLoading ? <p className="muted">Đang tải dữ liệu...</p> : null}
      {anyError && !(anyError instanceof ApiError && anyError.status === 403) ? (
        <p className="alert alert-error">
          {anyError instanceof Error ? anyError.message : 'Không thể tải dữ liệu'}
        </p>
      ) : null}

      <section className="kpi-grid">
        <KpiCard label="Đang online" value={liveQuery.data?.onlineNow ?? '—'} />
        <KpiCard label="Lobby hoạt động" value={liveQuery.data?.activeLobbies ?? '—'} />
        <KpiCard label="Trận đang chơi" value={liveQuery.data?.activeGames ?? '—'} />
        <KpiCard
          label="Cập nhật lần cuối"
          value={
            liveQuery.data?.updatedAt ? formatDateTime(liveQuery.data.updatedAt) : '—'
          }
        />
      </section>

      <section className="panel-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Xu hướng 24h</h2>
            <p className="muted">
              Đỉnh người chơi/giờ: {peakPlayers} · Tổng thời gian: {formatPlayTime(totalPlaySeconds)}
            </p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Giờ</th>
                  <th>Người chơi</th>
                  <th>Bắt đầu</th>
                  <th>Kết thúc</th>
                  <th>Thời gian chơi</th>
                </tr>
              </thead>
              <tbody>
                {(timeseriesQuery.data ?? []).slice(-12).map((row) => (
                  <tr key={row.bucket_start}>
                    <td>{formatDateTime(row.bucket_start)}</td>
                    <td>{row.unique_players}</td>
                    <td>{row.games_started}</td>
                    <td>{row.games_finished}</td>
                    <td>{formatPlayTime(row.total_play_seconds)}</td>
                  </tr>
                ))}
                {(timeseriesQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Chưa có dữ liệu rollup. Chờ người chơi hoạt động hoặc kiểm tra migration.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Top người chơi</h2>
            <p className="muted">Theo tổng thời gian chơi (tài khoản đã đăng ký)</p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>ID</th>
                  <th>Thời gian</th>
                  <th>Trận</th>
                  <th>Thắng</th>
                </tr>
              </thead>
              <tbody>
                {(topPlayersQuery.data ?? []).map((player, index) => (
                  <tr key={player.id}>
                    <td>{index + 1}</td>
                    <td>
                      <code className="mono">{player.id.slice(0, 8)}</code>
                    </td>
                    <td>{formatPlayTime(player.total_played_seconds)}</td>
                    <td>{player.total_games}</td>
                    <td>{formatWinRate(player.total_wins, player.total_games)}</td>
                  </tr>
                ))}
                {(topPlayersQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Chưa có dữ liệu người chơi
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  )
}
