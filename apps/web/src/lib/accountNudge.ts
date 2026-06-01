const LOBBY_NUDGE_PREFIX = 'rr-account-nudge-lobby:'

export function lobbyNudgeStorageKey(lobbyId: string): string {
  return `${LOBBY_NUDGE_PREFIX}${lobbyId}`
}

export function wasLobbyNudgeDismissed(lobbyId: string): boolean {
  try {
    return sessionStorage.getItem(lobbyNudgeStorageKey(lobbyId)) === '1'
  } catch {
    return false
  }
}

export function markLobbyNudgeDismissed(lobbyId: string): void {
  try {
    sessionStorage.setItem(lobbyNudgeStorageKey(lobbyId), '1')
  } catch {
    // ignore
  }
}

/** Delay after home form panel is shown before nudge overlay (ms). */
export const HOME_FORM_NUDGE_DELAY_MS = 320
