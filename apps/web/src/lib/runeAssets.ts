import type { RuneCardType } from '@rune-race/shared'

import runeAdvance2 from '../../assets/runes/rune-advance-2.png'
import runeAdvance3 from '../../assets/runes/rune-advance-3.png'
import runeAdvance4 from '../../assets/runes/rune-advance-4.png'
import runeBack3 from '../../assets/runes/rune-back-3.png'
import runeBack4 from '../../assets/runes/rune-back-4.png'
import runeBack5 from '../../assets/runes/rune-back-5.png'
import runeFreeze from '../../assets/runes/rune-freeze.png'
import runeLeaveStable from '../../assets/runes/rune-leave-stable.png'
import runeSendHome from '../../assets/runes/rune-send-home.png'
import runeShield from '../../assets/runes/rune-shield.png'
import runeSwap from '../../assets/runes/rune-swap.png'

export const RUNE_CARD_IMAGES: Record<RuneCardType, string> = {
  ADVANCE_2: runeAdvance2,
  ADVANCE_3: runeAdvance3,
  ADVANCE_4: runeAdvance4,
  BACK_3: runeBack3,
  BACK_4: runeBack4,
  BACK_5: runeBack5,
  FREEZE: runeFreeze,
  LEAVE_STABLE: runeLeaveStable,
  SEND_HOME: runeSendHome,
  SHIELD: runeShield,
  SWAP: runeSwap,
}

export const RUNE_CARD_LABELS: Record<RuneCardType, string> = {
  ADVANCE_2: 'Tiến 2',
  ADVANCE_3: 'Tiến 3',
  ADVANCE_4: 'Tiến 4',
  BACK_3: 'Lùi 3',
  BACK_4: 'Lùi 4',
  BACK_5: 'Lùi 5',
  FREEZE: 'Đóng băng',
  LEAVE_STABLE: 'Xuất chuồng',
  SEND_HOME: 'Về chuồng',
  SHIELD: 'Khiên',
  SWAP: 'Hoán vị',
}

/** One-line effect summary for card preview. */
export const RUNE_CARD_DESCRIPTIONS: Record<RuneCardType, string> = {
  LEAVE_STABLE: 'Dùng trực tiếp sau pha đặt — xuất một quân từ chuồng ra xuất phát.',
  SHIELD: 'Đi qua — chặn một bẫy Lùi, Đóng băng hoặc Về chuồng.',
  ADVANCE_2: 'Đi qua — cộng thêm 2 bước tiến.',
  ADVANCE_3: 'Đi qua — cộng thêm 3 bước tiến.',
  ADVANCE_4: 'Đi qua — cộng thêm 4 bước tiến.',
  BACK_3: 'Đi qua — buộc lùi 3 bước.',
  BACK_4: 'Đi qua — buộc lùi 4 bước.',
  BACK_5: 'Đi qua — buộc lùi 5 bước.',
  FREEZE: 'Đi qua — dừng ngay và khóa quân 2 lượt.',
  SEND_HOME: 'Dừng đúng ô — đưa quân kích hoạt về chuồng.',
  SWAP: 'Dừng đúng ô — hoán vị với quân của danh tính marker.',
}
