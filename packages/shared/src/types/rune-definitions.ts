import type { RuneCardDefinition, RuneCardType } from './rune.js'

export const RUNE_CARD_DEFINITIONS: Record<RuneCardType, RuneCardDefinition> = {
  LEAVE_STABLE: {
    cardType: 'LEAVE_STABLE',
    category: 'SUPPORT',
    activationKind: 'DIRECT_USE',
    triggerMode: null,
    markerTTL: null,
    stepValue: null,
  },
  SHIELD: {
    cardType: 'SHIELD',
    category: 'SUPPORT',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'PASS_THROUGH',
    markerTTL: 3,
    stepValue: null,
  },
  ADVANCE_2: {
    cardType: 'ADVANCE_2',
    category: 'SUPPORT',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'PASS_THROUGH',
    markerTTL: 3,
    stepValue: 2,
  },
  ADVANCE_3: {
    cardType: 'ADVANCE_3',
    category: 'SUPPORT',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'PASS_THROUGH',
    markerTTL: 3,
    stepValue: 3,
  },
  ADVANCE_4: {
    cardType: 'ADVANCE_4',
    category: 'SUPPORT',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'PASS_THROUGH',
    markerTTL: 3,
    stepValue: 4,
  },
  BACK_3: {
    cardType: 'BACK_3',
    category: 'TRAP',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'PASS_THROUGH',
    markerTTL: 3,
    stepValue: 3,
  },
  BACK_4: {
    cardType: 'BACK_4',
    category: 'TRAP',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'PASS_THROUGH',
    markerTTL: 3,
    stepValue: 4,
  },
  BACK_5: {
    cardType: 'BACK_5',
    category: 'TRAP',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'PASS_THROUGH',
    markerTTL: 3,
    stepValue: 5,
  },
  FREEZE: {
    cardType: 'FREEZE',
    category: 'TRAP',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'PASS_THROUGH',
    markerTTL: 3,
    stepValue: null,
  },
  SEND_HOME: {
    cardType: 'SEND_HOME',
    category: 'TRAP',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'EXACT_STOP',
    markerTTL: 5,
    stepValue: null,
  },
  SWAP: {
    cardType: 'SWAP',
    category: 'SPECIAL',
    activationKind: 'BOARD_MARKER',
    triggerMode: 'EXACT_STOP',
    markerTTL: 5,
    stepValue: null,
  },
}

export function isBoardMarkerCardType(cardType: RuneCardType): boolean {
  return RUNE_CARD_DEFINITIONS[cardType].activationKind === 'BOARD_MARKER'
}
