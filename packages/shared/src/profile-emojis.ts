/** Allowed profile avatar emojis (fruit, flowers, plants, vegetables). */
export const PROFILE_EMOJIS = [
  // Trái cây
  '🍎',
  '🍊',
  '🍋',
  '🍇',
  '🍉',
  '🍓',
  '🍒',
  '🥭',
  '🍍',
  '🥝',
  '🫐',
  '🥥',
  // Hoa
  '🌸',
  '🌺',
  '🌻',
  '🌹',
  '🌷',
  '💐',
  '🌼',
  '🪷',
  // Cây cỏ
  '🌿',
  '🍀',
  '🌱',
  '🪴',
  '🌳',
  '🌲',
  '🌾',
  '🍃',
  // Rau củ
  '🥕',
  '🌽',
  '🥦',
  '🥬',
  '🫑',
  '🥒',
  '🍆',
  '🧅',
  '🥔',
  '🍠',
  '🌶️',
  '🫛',
  '🍄',
] as const

export type ProfileEmoji = (typeof PROFILE_EMOJIS)[number]

export const PROFILE_EMOJI_SET = new Set<string>(PROFILE_EMOJIS)

export function isAllowedProfileEmoji(value: string): value is ProfileEmoji {
  return PROFILE_EMOJI_SET.has(value)
}
