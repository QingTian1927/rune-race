import { describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { buildRegisteredUsersReport } from './admin-users-report'

describe('buildRegisteredUsersReport', () => {
  it('merges registered profiles with auth users and excludes anon', () => {
    const profiles = [
      {
        id: 'user-1',
        full_name: 'Nguyễn Văn A',
        phone: '0901111111',
        created_at: '2026-05-01T00:00:00.000Z',
        last_played_at: '2026-06-01T12:00:00.000Z',
      },
      {
        id: 'user-2',
        full_name: null,
        phone: null,
        created_at: '2026-05-02T00:00:00.000Z',
        last_played_at: null,
      },
      {
        id: 'anon-profile',
        full_name: 'Ẩn danh',
        phone: null,
        created_at: '2026-05-03T00:00:00.000Z',
        last_played_at: null,
      },
    ]

    const authUsers = [
      {
        id: 'user-1',
        email: 'a@gmail.com',
        created_at: '2026-05-01T08:00:00.000Z',
        user_metadata: { is_anon: false },
      },
      {
        id: 'user-2',
        email: 'b@gmail.com',
        created_at: '2026-05-02T09:00:00.000Z',
        user_metadata: { full_name: 'Trần Thị B' },
      },
      {
        id: 'anon-profile',
        email: null,
        created_at: '2026-05-03T00:00:00.000Z',
        user_metadata: { is_anon: true },
      },
      {
        id: 'orphan-auth',
        email: 'orphan@gmail.com',
        created_at: '2026-05-04T00:00:00.000Z',
        user_metadata: {},
      },
    ] as User[]

    const rows = buildRegisteredUsersReport(profiles, authUsers)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: 'user-1',
      fullName: 'Nguyễn Văn A',
      email: 'a@gmail.com',
      phone: '0901111111',
      accountCreatedAt: '2026-05-01T08:00:00.000Z',
      lastPlayedAt: '2026-06-01T12:00:00.000Z',
    })
    expect(rows[1]).toMatchObject({
      id: 'user-2',
      fullName: 'Trần Thị B',
      email: 'b@gmail.com',
      phone: null,
      lastPlayedAt: null,
    })
  })
})
