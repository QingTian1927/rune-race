/**
 * Bot player helpers shared between server and client.
 */

export const BOT_PLAYER_ID_PREFIX = 'bot-'

/** Server-only difficulty profile — never included in lobby snapshots. */
export type BotProfile = 'simple' | 'complex'

export function isBotPlayerId(playerId: string): boolean {
  return playerId.startsWith(BOT_PLAYER_ID_PREFIX)
}
