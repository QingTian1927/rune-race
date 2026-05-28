const PLAYER_ID_KEY = 'rune-race-player-id'
const PLAYER_NAME_KEY = 'rune-race-player-name'

/** randomUUID requires a secure context; LAN HTTP only has getRandomValues. */
function createRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = (Math.random() * 16) | 0
    const value = char === 'x' ? n : (n & 0x3) | 0x8
    return value.toString(16)
  })
}

function randomId() {
  return `anon-${createRandomUUID()}`
}

/** Legacy clients stored `anon-<uuid>` before Supabase anonymous auth. */
export function isLegacyLocalAnonId(id: string): boolean {
  return id.startsWith('anon-')
}

export function syncPlayerIdFromAuth(authUserId: string): void {
  localStorage.setItem(PLAYER_ID_KEY, authUserId)
}

export function clearStoredPlayerId(): void {
  localStorage.removeItem(PLAYER_ID_KEY)
}

export function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY)
  if (existing) return existing
  const id = randomId()
  localStorage.setItem(PLAYER_ID_KEY, id)
  return id
}

export function getPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) ?? 'Player'
}

export function setPlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name.trim() || 'Player')
}
