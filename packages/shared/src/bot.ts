/**
 * Bot player helpers shared between server and client.
 */

export const BOT_PLAYER_ID_PREFIX = 'bot-'

/** Client UI marker for bot avatars (not a profile emoji). */
export const BOT_AVATAR_SENTINEL = '__bot_avatar__'

/** Server-only difficulty profile — never included in lobby snapshots. */
export type BotProfile = 'simple' | 'complex'

export function isBotPlayerId(playerId: string): boolean {
  return playerId.startsWith(BOT_PLAYER_ID_PREFIX)
}

export function isBotAvatarSentinel(value: string | null | undefined): boolean {
  return value === BOT_AVATAR_SENTINEL
}
