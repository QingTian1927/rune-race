import { useQuery } from '@tanstack/react-query'
import { KpiCard } from '../components/KpiCard'
import { fetchReadinessDetail, type AdminReadinessCheck, type OverallReadinessStatus } from '../lib/api'
import { formatDateTime, formatUptime } from '../lib/format'

const CHECK_LABELS: Record<string, string> = {
  api: 'API HTTP',
  socket: 'Socket.IO',
  database: 'Supabase',
  analytics: 'Analytics scheduler',
}

const OVERALL_LABELS: Record<OverallReadinessStatus, string> = {
  ready: 'Sẵn sàng',
  degraded: 'Hoạt động một phần',
  down: 'Gián đoạn',
}

function checkStatusLabel(status: AdminReadinessCheck['status']): string {
  switch (status) {
    case 'ok':
      return 'OK'
    case 'warn':
      return 'Cảnh báo'
    case 'fail':
      return 'Lỗi'
    case 'skipped':
      return 'Bỏ qua'
  }
}

function formatLatency(latencyMs?: number): string {
  if (latencyMs === undefined) return '—'
  return `${latencyMs} ms`
}

function formatBool(value: boolean): string {
  return value ? 'Có' : 'Không'
}

export default function SystemStatusPage() {
  const readinessQuery = useQuery({
    queryKey: ['admin', 'readiness'],
    queryFn: fetchReadinessDetail,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const data = readinessQuery.data

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Trạng thái hệ thống</h1>
          <p className="muted">Readiness probe từ API · làm mới tự động mỗi 30 giây</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void readinessQuery.refetch()}>
          Làm mới
        </button>
      </header>

      {readinessQuery.isLoading ? <p className="muted">Đang kiểm tra readiness...</p> : null}
      {readinessQuery.error ? (
        <p className="alert alert-error">
          {readinessQuery.error instanceof Error
            ? readinessQuery.error.message
            : 'Không thể tải trạng thái readiness'}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="status-hero">
            <div className={`status-pill status-pill--${data.status}`}>
              {OVERALL_LABELS[data.status]}
            </div>
            <div className="status-hero-meta">
              <p>
                <span className="muted">Cập nhật:</span> {formatDateTime(data.timestamp)}
              </p>
              <p>
                <span className="muted">Uptime:</span> {formatUptime(data.uptimeSeconds)}
              </p>
              <p>
                <span className="muted">Môi trường:</span> <code className="mono">{data.nodeEnv}</code>
              </p>
            </div>
          </section>

          <section className="kpi-grid">
            <KpiCard label="Lobby hoạt động" value={data.metrics.activeLobbies} />
            <KpiCard label="Trận đang chơi" value={data.metrics.activeGames} />
            <KpiCard label="Socket kết nối" value={data.metrics.connectedSockets} />
            <KpiCard label="Hàng matchmaking" value={data.metrics.matchmakingQueueSize} />
          </section>

          <section className="panel-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>Kiểm tra thành phần</h2>
                <p className="muted">Chỉ API và Socket.IO là critical cho trạng thái down</p>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Thành phần</th>
                      <th>Trạng thái</th>
                      <th>Critical</th>
                      <th>Độ trễ</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.checks).map(([name, check]) => (
                      <tr key={name}>
                        <td>{CHECK_LABELS[name] ?? name}</td>
                        <td>
                          <span className={`check-pill check-pill--${check.status}`}>
                            {checkStatusLabel(check.status)}
                          </span>
                        </td>
                        <td>{check.critical ? 'Có' : 'Không'}</td>
                        <td>{formatLatency(check.latencyMs)}</td>
                        <td className="check-message">{check.message ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Phụ thuộc & cấu hình</h2>
                <p className="muted">Ảnh hưởng tới analytics, auth và feature flags</p>
              </div>
              <div className="panel-body">
                <dl className="meta-list">
                  <div className="meta-row">
                    <dt>Supabase đã cấu hình</dt>
                    <dd>{formatBool(data.dependencies.supabaseConfigured)}</dd>
                  </div>
                  <div className="meta-row">
                    <dt>Analytics scheduler</dt>
                    <dd>{formatBool(data.dependencies.analyticsSchedulerActive)}</dd>
                  </div>
                  <div className="meta-row">
                    <dt>CORS giới hạn origin</dt>
                    <dd>{formatBool(data.dependencies.corsRestricted)}</dd>
                  </div>
                </dl>
                <p className="muted status-footnote">
                  Endpoint: <code className="mono">GET /ready?detail=admin</code>
                </p>
              </div>
            </section>
          </section>
        </>
      ) : null}
    </div>
  )
}
