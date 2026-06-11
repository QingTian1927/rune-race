import type { RuneCardType } from '@rune-race/shared'
import { RUNE_CARD_IMAGES, RUNE_CARD_LABELS } from './runeAssets'

export type RuneCardGroup = 'support' | 'trap' | 'special'

export type MarketingRuneCard = {
  type: RuneCardType
  group: RuneCardGroup
  label: string
  image: string
}

export const MARKETING_RUNE_CARDS: MarketingRuneCard[] = [
  { type: 'LEAVE_STABLE', group: 'support', label: `Thẻ ${RUNE_CARD_LABELS.LEAVE_STABLE}`, image: RUNE_CARD_IMAGES.LEAVE_STABLE },
  { type: 'SHIELD', group: 'support', label: `Thẻ ${RUNE_CARD_LABELS.SHIELD} chắn`, image: RUNE_CARD_IMAGES.SHIELD },
  { type: 'ADVANCE_2', group: 'support', label: `Thẻ ${RUNE_CARD_LABELS.ADVANCE_2} bước`, image: RUNE_CARD_IMAGES.ADVANCE_2 },
  { type: 'ADVANCE_3', group: 'support', label: `Thẻ ${RUNE_CARD_LABELS.ADVANCE_3} bước`, image: RUNE_CARD_IMAGES.ADVANCE_3 },
  { type: 'ADVANCE_4', group: 'support', label: `Thẻ ${RUNE_CARD_LABELS.ADVANCE_4} bước`, image: RUNE_CARD_IMAGES.ADVANCE_4 },
  { type: 'BACK_3', group: 'trap', label: `Thẻ ${RUNE_CARD_LABELS.BACK_3} bước`, image: RUNE_CARD_IMAGES.BACK_3 },
  { type: 'BACK_4', group: 'trap', label: `Thẻ ${RUNE_CARD_LABELS.BACK_4} bước`, image: RUNE_CARD_IMAGES.BACK_4 },
  { type: 'BACK_5', group: 'trap', label: `Thẻ ${RUNE_CARD_LABELS.BACK_5} bước`, image: RUNE_CARD_IMAGES.BACK_5 },
  { type: 'FREEZE', group: 'trap', label: `Thẻ ${RUNE_CARD_LABELS.FREEZE}`, image: RUNE_CARD_IMAGES.FREEZE },
  { type: 'SEND_HOME', group: 'trap', label: `Thẻ ${RUNE_CARD_LABELS.SEND_HOME}`, image: RUNE_CARD_IMAGES.SEND_HOME },
  { type: 'SWAP', group: 'special', label: `Thẻ ${RUNE_CARD_LABELS.SWAP}`, image: RUNE_CARD_IMAGES.SWAP },
]

export const HOME_CARD_RAIL_TYPES: RuneCardType[] = [
  'LEAVE_STABLE',
  'SHIELD',
  'ADVANCE_3',
  'BACK_5',
  'FREEZE',
  'SEND_HOME',
  'SWAP',
]

export const RUNE_FILTER_LABELS: Record<RuneCardGroup | 'all', string> = {
  all: 'Tất cả',
  support: 'Hỗ trợ',
  trap: 'Bẫy',
  special: 'Đặc biệt',
}
