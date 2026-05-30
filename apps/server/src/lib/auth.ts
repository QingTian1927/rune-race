import type { FastifyReply, FastifyRequest } from 'fastify'
import type { User } from '@supabase/supabase-js'
import { isRegisteredFromMetadata } from '@rune-race/shared'
import { getUserFromAccessToken } from './supabase-server'

export function isRegisteredUser(user: User | null | undefined): boolean {
  if (!user) return false
  return isRegisteredFromMetadata(user.user_metadata as Record<string, unknown>)
}

export function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (!header) return null
  const [type, token] = header.split(' ')
  if (type !== 'Bearer' || !token) return null
  return token
}

export async function getAuthUser(request: FastifyRequest): Promise<User | null> {
  const token = getBearerToken(request)
  if (!token) return null
  return getUserFromAccessToken(token)
}

export async function requireAuthUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<User | null> {
  const user = await getAuthUser(request)
  if (!user) {
    await reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  return user
}
