import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { ApiError, fetchAdminSettings, updateAdminSettings } from '../lib/api'
import {
  datetimeLocalValueToIso,
  defaultBannerUntilLocalValue,
  isoToDatetimeLocalValue,
  SITE_BANNER_DEFAULT_DURATION_DAYS,
  SITE_BANNER_DEFAULT_LINK_LABEL,
  SITE_BANNER_MESSAGE_MAX_LENGTH,
  siteBannerStatusLabel,
} from '../lib/site-banner'

type BannerFormState = {
  enabled: boolean
  message: string
  linkUrl: string
  linkLabel: string
  visibleFrom: string
  visibleUntil: string
}

function emptyForm(): BannerFormState {
  return {
    enabled: false,
    message: '',
    linkUrl: '',
    linkLabel: SITE_BANNER_DEFAULT_LINK_LABEL,
    visibleFrom: '',
    visibleUntil: defaultBannerUntilLocalValue(),
  }
}

function formFromSettings(settings: NonNullable<Awaited<ReturnType<typeof fetchAdminSettings>>>): BannerFormState {
  const banner = settings.siteBanner
  if (!banner) return emptyForm()
  return {
    enabled: banner.enabled,
    message: banner.message,
    linkUrl: banner.linkUrl ?? '',
    linkLabel: banner.linkLabel || SITE_BANNER_DEFAULT_LINK_LABEL,
    visibleFrom: isoToDatetimeLocalValue(banner.visibleFrom),
    visibleUntil: isoToDatetimeLocalValue(banner.visibleUntil) || defaultBannerUntilLocalValue(),
  }
}

export function SiteBannerPanel() {
  const { accessToken } = useAuth()
  const token = accessToken!
  const queryClient = useQueryClient()
  const [form, setForm] = useState<BannerFormState>(emptyForm)

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => fetchAdminSettings(token),
    enabled: Boolean(accessToken),
  })

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(formFromSettings(settingsQuery.data))
    }
  }, [settingsQuery.data])

  const mutation = useMutation({
    mutationFn: () =>
      updateAdminSettings(token, {
        siteBanner: {
          enabled: form.enabled,
          message: form.message,
          linkUrl: form.linkUrl.trim() ? form.linkUrl.trim() : null,
          linkLabel: form.linkLabel.trim() || SITE_BANNER_DEFAULT_LINK_LABEL,
          visibleFrom: datetimeLocalValueToIso(form.visibleFrom),
          visibleUntil: datetimeLocalValueToIso(form.visibleUntil),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
  })

  if (settingsQuery.error instanceof ApiError && settingsQuery.error.status === 403) {
    return null
  }

  const status = settingsQuery.data?.siteBannerStatus ?? 'empty'
  const statusClass =
    status === 'live' ? 'site-banner-status-live' : status === 'expired' ? 'site-banner-status-expired' : ''

  return (
    <section className="panel site-banner-panel">
      <div className="panel-head">
        <h2>Banner thông báo</h2>
        <p className="muted">
          Thanh vàng dưới header — mỗi user chỉ thấy một lần cho mỗi banner. Mặc định tự tắt sau{' '}
          {SITE_BANNER_DEFAULT_DURATION_DAYS} ngày.
        </p>
      </div>

      <div className="panel-body site-banner-form">
        {settingsQuery.isLoading ? <p className="muted">Đang tải cài đặt...</p> : null}

        {settingsQuery.error ? (
          <p className="alert alert-error">
            {settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Lỗi tải cài đặt'}
          </p>
        ) : null}

        {mutation.error ? (
          <p className="alert alert-error">
            {mutation.error instanceof Error ? mutation.error.message : 'Không lưu được'}
          </p>
        ) : null}

        {mutation.isSuccess ? <p className="alert alert-success">Đã lưu banner.</p> : null}

        <p className={`site-banner-status ${statusClass}`}>
          Trạng thái: <strong>{siteBannerStatusLabel(status)}</strong>
        </p>

        <label className="feature-flag-row site-banner-toggle-row">
          <span className="feature-flag-label">
            <strong className="feature-flag-title">Bật banner</strong>
            <span className="muted feature-flag-hint">Tắt để ẩn ngay trên web (user đã dismiss vẫn không thấy lại).</span>
          </span>
          <input
            type="checkbox"
            className="feature-flag-toggle"
            checked={form.enabled}
            disabled={mutation.isPending}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            aria-label="Bật banner thông báo"
          />
        </label>

        <label className="field site-banner-field">
          <span>Nội dung (1 dòng, emoji OK)</span>
          <input
            type="text"
            value={form.message}
            maxLength={SITE_BANNER_MESSAGE_MAX_LENGTH}
            disabled={mutation.isPending}
            placeholder="🎉 Cập nhật mới — xem hướng dẫn chơi online"
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          />
        </label>

        <div className="site-banner-field-grid">
          <label className="field site-banner-field">
            <span>Link (tuỳ chọn)</span>
            <input
              type="url"
              value={form.linkUrl}
              disabled={mutation.isPending}
              placeholder="https://..."
              onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
            />
          </label>
          <label className="field site-banner-field">
            <span>Nhãn link</span>
            <input
              type="text"
              value={form.linkLabel}
              disabled={mutation.isPending}
              onChange={(e) => setForm((prev) => ({ ...prev, linkLabel: e.target.value }))}
            />
          </label>
        </div>

        <div className="site-banner-field-grid">
          <label className="field site-banner-field">
            <span>Hiển thị từ (tuỳ chọn)</span>
            <input
              type="datetime-local"
              value={form.visibleFrom}
              disabled={mutation.isPending}
              onChange={(e) => setForm((prev) => ({ ...prev, visibleFrom: e.target.value }))}
            />
          </label>
          <label className="field site-banner-field">
            <span>Hiển thị đến</span>
            <input
              type="datetime-local"
              value={form.visibleUntil}
              disabled={mutation.isPending}
              onChange={(e) => setForm((prev) => ({ ...prev, visibleUntil: e.target.value }))}
            />
          </label>
        </div>

        <div className="site-banner-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={mutation.isPending || settingsQuery.isLoading}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu banner'}
          </button>
        </div>
      </div>
    </section>
  )
}
