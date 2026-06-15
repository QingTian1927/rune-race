import { describe, expect, it } from 'vitest'
import {
  defaultSiteBannerVisibleUntil,
  getSiteBannerAdminStatus,
  isSiteBannerScheduleActive,
  normalizeSiteBannerMessage,
  SITE_BANNER_DEFAULT_DURATION_DAYS,
} from '@rune-race/shared'

describe('site banner shared helpers', () => {
  it('normalizes message to a single line', () => {
    expect(normalizeSiteBannerMessage('  Hello 🎉\nworld  ')).toBe('Hello 🎉 world')
  })

  it('defaults visibleUntil to 7 days ahead', () => {
    const from = new Date('2026-06-15T12:00:00.000Z')
    const until = defaultSiteBannerVisibleUntil(from)
    const diffDays = (Date.parse(until) - from.getTime()) / (24 * 60 * 60 * 1000)
    expect(diffDays).toBe(SITE_BANNER_DEFAULT_DURATION_DAYS)
  })

  it('detects active schedule windows', () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    expect(
      isSiteBannerScheduleActive(
        {
          enabled: true,
          message: 'Update',
          visibleFrom: '2026-06-15T10:00:00.000Z',
          visibleUntil: '2026-06-16T10:00:00.000Z',
        },
        now,
      ),
    ).toBe(true)
    expect(
      isSiteBannerScheduleActive(
        {
          enabled: true,
          message: 'Update',
          visibleFrom: null,
          visibleUntil: '2026-06-15T11:00:00.000Z',
        },
        now,
      ),
    ).toBe(false)
  })

  it('reports admin status', () => {
    const now = new Date('2026-06-15T12:00:00.000Z')
    expect(
      getSiteBannerAdminStatus(
        {
          id: '1',
          enabled: true,
          message: 'Live',
          linkUrl: null,
          linkLabel: 'Xem thêm',
          visibleFrom: null,
          visibleUntil: '2026-06-16T12:00:00.000Z',
        },
        now,
      ),
    ).toBe('live')
    expect(
      getSiteBannerAdminStatus(
        {
          id: '1',
          enabled: true,
          message: 'Soon',
          linkUrl: null,
          linkLabel: 'Xem thêm',
          visibleFrom: '2026-06-16T12:00:00.000Z',
          visibleUntil: '2026-06-17T12:00:00.000Z',
        },
        now,
      ),
    ).toBe('scheduled')
  })
})
