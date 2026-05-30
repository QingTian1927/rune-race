import { linkAnonProfile } from './api'

const ANON_USER_ID_KEY = 'rune-race-anon-user-id'

export function rememberAnonUserId(userId: string): void {
  localStorage.setItem(ANON_USER_ID_KEY, userId)
}

export function clearRememberedAnonUserId(): void {
  localStorage.removeItem(ANON_USER_ID_KEY)
}

/** Merge prior guest stats into the newly authenticated account. */
export async function linkAnonSessionIfNeeded(
  accessToken: string,
  registeredUserId: string,
): Promise<void> {
  const anonId = localStorage.getItem(ANON_USER_ID_KEY)?.trim()
  if (!anonId || anonId === registeredUserId) return

  try {
    await linkAnonProfile(accessToken, anonId)
    clearRememberedAnonUserId()
  } catch {
    // Non-fatal; user can retry by signing in again.
  }
}
