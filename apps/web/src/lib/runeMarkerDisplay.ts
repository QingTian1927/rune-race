import type {
  BoardMarker,
  PublicBoardMarker,
  RuneCardType,
  RuneClientView,
  RuneTriggerMode,
} from '@rune-race/shared'
import { RUNE_CARD_DEFINITIONS } from '@rune-race/shared'

type MarkerLike = BoardMarker | PublicBoardMarker

export function triggerModeForMarker(
  marker: MarkerLike,
  _runeView?: RuneClientView | null,
): RuneTriggerMode | null {
  if ('triggerMode' in marker && marker.triggerMode) {
    return marker.triggerMode
  }
  if ('cardType' in marker && marker.cardType) {
    return RUNE_CARD_DEFINITIONS[marker.cardType as RuneCardType].triggerMode
  }
  return null
}

export function triggerModeForCardType(cardType: RuneCardType): RuneTriggerMode {
  return RUNE_CARD_DEFINITIONS[cardType].triggerMode
}

const PLACEMENT_REJECT_MESSAGES: Record<string, string> = {
  invalid_phase: 'Không còn trong pha đặt rune.',
  not_in_game: 'Bạn không còn trong ván.',
  card_not_found: 'Thẻ không còn trong tay.',
  invalid_identity: 'Danh tính hiển thị không hợp lệ.',
  invalid_cell: 'Ô này không thể đặt rune.',
  cell_taken: 'Ô đã có rune hoặc quân đang đứng.',
}

export function placementRejectMessage(reason: unknown): string {
  if (typeof reason === 'string' && PLACEMENT_REJECT_MESSAGES[reason]) {
    return PLACEMENT_REJECT_MESSAGES[reason]
  }
  return 'Không thể đặt rune tại ô này.'
}

export function isTouchPlacementDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}
