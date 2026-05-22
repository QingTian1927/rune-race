import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return true
  const [salt, expected] = stored.split(':')
  if (!salt || !expected) return false
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(expected))
  } catch {
    return false
  }
}
