/** Client-side fallback ids (`anon-<uuid>`) before Supabase anonymous auth. */
export function isLegacyLocalPlayerId(playerId: string): boolean {
  return playerId.startsWith('anon-')
}
