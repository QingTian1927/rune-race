export const PROFILE_EMOJIS = [
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
] as const

export type ProfileEmoji = (typeof PROFILE_EMOJIS)[number]
