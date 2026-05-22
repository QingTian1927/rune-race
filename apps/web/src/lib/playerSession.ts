const PLAYER_ID_KEY = 'rune-race-player-id'
const PLAYER_NAME_KEY = 'rune-race-player-name'

function randomId() {
  return `anon-${crypto.randomUUID()}`
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
