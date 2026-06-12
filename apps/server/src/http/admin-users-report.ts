import type { FastifyInstance } from 'fastify'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { fullNameFromMetadata } from '@rune-race/shared'
import { requireAuthUser } from '../lib/auth'
import { isAdminUser } from '../lib/admin-auth'
import { getSupabaseAdminClient } from '../lib/supabase-server'

export type AdminReportUser = {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  accountCreatedAt: string | null
  lastPlayedAt: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  phone: string | null
  created_at: string
  last_played_at: string | null
}

async function listAllAuthUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    users.push(...data.users)
    if (data.users.length < 1000) break
    page += 1
  }

  return users
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function buildRegisteredUsersReport(
  profiles: ProfileRow[],
  authUsers: User[],
): AdminReportUser[] {
  const authById = new Map<string, User>()
  for (const user of authUsers) {
    const meta = user.user_metadata as Record<string, unknown> | undefined
    if (meta?.is_anon === true) continue
    authById.set(user.id, user)
  }

  const rows: AdminReportUser[] = []

  for (const profile of profiles) {
    const authUser = authById.get(profile.id)
    if (!authUser) continue

    const meta = authUser.user_metadata as Record<string, unknown> | undefined
    rows.push({
      id: profile.id,
      fullName: trimOrNull(profile.full_name) ?? fullNameFromMetadata(meta),
      email: trimOrNull(authUser.email),
      phone: trimOrNull(profile.phone),
      accountCreatedAt: authUser.created_at ?? profile.created_at ?? null,
      lastPlayedAt: profile.last_played_at ?? null,
    })
  }

  rows.sort((a, b) => {
    const ta = a.accountCreatedAt ? Date.parse(a.accountCreatedAt) : 0
    const tb = b.accountCreatedAt ? Date.parse(b.accountCreatedAt) : 0
    return ta - tb
  })

  return rows
}

export async function fetchRegisteredUsersReport(
  supabase: SupabaseClient,
): Promise<AdminReportUser[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, created_at, last_played_at')
    .eq('is_anon', false)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const authUsers = await listAllAuthUsers(supabase)
  return buildRegisteredUsersReport((profiles ?? []) as ProfileRow[], authUsers)
}

export function registerAdminUsersReportRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/admin/users/report', async (request, reply) => {
    try {
      const user = await requireAuthUser(request, reply)
      if (!user) return
      if (!isAdminUser(user.id)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const supabase = getSupabaseAdminClient()
      if (!supabase) {
        return reply.status(503).send({ error: 'Supabase not configured on server' })
      }

      const users = await fetchRegisteredUsersReport(supabase)
      return {
        generatedAt: new Date().toISOString(),
        total: users.length,
        users,
      }
    } catch (err) {
      request.log.error({ err }, 'admin_users_report_failed')
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to load user report',
      })
    }
  })
}
