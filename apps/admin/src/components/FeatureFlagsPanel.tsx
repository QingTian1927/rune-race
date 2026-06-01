import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { ApiError, fetchAdminSettings, updateAdminSettings } from '../lib/api'

export function FeatureFlagsPanel() {
  const { accessToken } = useAuth()
  const token = accessToken!
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => fetchAdminSettings(token),
    enabled: Boolean(accessToken),
  })

  const mutation = useMutation({
    mutationFn: (accountNudgeEnabled: boolean) => updateAdminSettings(token, { accountNudgeEnabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
  })

  if (settingsQuery.error instanceof ApiError && settingsQuery.error.status === 403) {
    return null
  }

  const settings = settingsQuery.data
  const envLocked = settings?.accountNudgeEnvDisabled ?? false
  const enabled = settings?.accountNudgeEnabled ?? true
  const toggleDisabled = envLocked || mutation.isPending || settingsQuery.isLoading

  return (
    <section className="panel feature-flags-panel">
      <div className="panel-head">
        <h2>Tính năng sản phẩm</h2>
        <p className="muted">Bật/tắt nhanh popup khuyến khích đăng ký (chỉ user anon).</p>
      </div>

      <div className="panel-body">
        {settingsQuery.isLoading ? <p className="muted feature-flags-status">Đang tải cài đặt...</p> : null}

        {settingsQuery.error ? (
          <p className="alert alert-error feature-flags-alert">
            {settingsQuery.error instanceof Error
              ? settingsQuery.error.message
              : 'Lỗi tải cài đặt'}
          </p>
        ) : null}

        {mutation.error ? (
          <p className="alert alert-error feature-flags-alert">
            {mutation.error instanceof Error ? mutation.error.message : 'Không lưu được'}
          </p>
        ) : null}

        <label className="feature-flag-row">
          <span className="feature-flag-label">
            <strong className="feature-flag-title">Popup đăng nhập / đăng ký (anon)</strong>
            <span className="muted feature-flag-hint">
              Tắt khi đã đủ KPI. Kill switch cứng:{' '}
              <code>ACCOUNT_NUDGE_ENABLED=false</code> trên server.
            </span>
          </span>
          <input
            type="checkbox"
            className="feature-flag-toggle"
            checked={enabled}
            disabled={toggleDisabled}
            onChange={(e) => mutation.mutate(e.target.checked)}
            aria-label="Bật popup khuyến khích đăng ký cho user anon"
          />
        </label>

        {envLocked ? (
          <p className="alert alert-error feature-flags-alert">
            Server env đang tắt cứng — bỏ <code>ACCOUNT_NUDGE_ENABLED=false</code> để admin bật lại.
          </p>
        ) : null}
      </div>
    </section>
  )
}
