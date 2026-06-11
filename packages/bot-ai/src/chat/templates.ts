import type { BotProfile } from '@rune-race/shared'
import type { BotChatTrigger, Rng } from '../types.js'

type MessagePools = Record<BotChatTrigger, { simple: string[]; complex: string[] }>

/**
 * Chat chủ yếu tiếng Việt + teencode.
 * Tiếng Anh chỉ dùng từ/slang game phổ biến ở VN: gg, wp, ez, ok, sorry, lag, ping, rng, chill, fair...
 */
const POOLS: MessagePools = {
  game_start: {
    simple: [
      'gl hf mn :v',
      'chiến thôiii',
      'vô vô vô',
      'lẹ lẹ tới lượt tui đi',
      'ok bắt đầu nha',
      'hôm nay ai thua trả nước :v',
      'ai sợ ai đâu',
      'roll thôi roll thôi',
      'ván này chill thôi mn',
      'đừng đá tui nhiều nha huhu',
      'tui mới vào đừng bully nha',
      'let\'s goooo',
      'ready chưa mọi người',
      'xúc xắc ơi mếnh thương tui',
      'hôm nay tui đen hay đỏ ta',
      'ván khởi động thôi kkk',
      'mn đánh nhẹ tay nha :v',
      'tui hơi run nha :v',
    ],
    complex: [
      'gl hf mọi người',
      'để xem ai đỏ hơn nào',
      'ván này tính toán kỹ nha',
      'ai gáy trước thường thua đó :v',
      'đầu ván quan sát bàn trước đã',
      'đọc bàn trước rồi hãy đánh',
      'đầu game đừng vội vàng',
      'ván này nhịp độ quan trọng lắm',
      'mn chơi fair nha, tui ghi chép hết đó',
      'chơi vui là chính nha',
      'không toxic nha, chill thôi',
      'tui thích ván có rune, cay hơn',
      'hết countdown là chiến luôn',
      'lượt đầu ai may mắn ta',
      'giai đoạn setup, đừng coi thường bot :v',
      'ok tập trung rồi',
      'ván này ai lừa rune trước thì hay',
      'chúc mn vui, thua cũng không giận nha',
    ],
  },
  bot_captured_enemy: {
    simple: [
      'hehe bayyy',
      'về chuồng nhaaa :v',
      'xin lỗi nha kkk',
      'ez đá đít',
      'tạm biệt anh bạn',
      'sorry nha, không cố ý đâu (có)',
      'hẹn gặp lại ở chuồng',
      'đá một cái cho vui thôi',
      'trượt tí là về chuồng luôn',
      'bye bye ngựa ơi',
      'có ai thấy không :v',
      'free ăn quân hehe',
      'đúng ô đúng giờ',
      'ăn ngon quá',
      'mlem mlem',
      'đá đít chuyên nghiệp',
      'tui cũng không cố ý đâu (có thật)',
      'về chuồng nghỉ ngơi đi',
      'về chuồng rồi ra lại đi :v',
    ],
    complex: [
      'đúng kế hoạch hehe',
      'đứng đó là sai lầm rồi',
      'sorry nha, không có gì cá nhân đâu :v',
      'một con về chuồng, đẹp',
      'thời điểm ăn quân chuẩn',
      'rủi ro đã tính từ trước',
      'nhịp độ tăng cho tui rồi',
      'kiểm soát bàn cờ tốt hơn rồi',
      'đúng ô đúng lúc, chuẩn chỉnh luôn',
      'phạt lỗi đối thủ, kinh điển',
      'bạn để lộ quá rõ rồi',
      'đổi quân có lợi cho tui',
      'ăn quân này mở đường về đích',
      'gây áp lực thành công',
      'mục tiêu tiếp theo là ai ta :v',
      'không phải may mắn, là kế hoạch',
      'ăn quân sạch sẽ, không bình luận',
      'đứng vị trí đúng là thắng',
    ],
  },
  bot_was_captured: {
    simple: [
      'ơ kìa???',
      'huhu con ngựa của tui',
      'cay thậttt',
      'ờm... tính cả rồi (không)',
      'đau quá đau quá',
      'trời ơi trời ơi',
      'ai làm vậy???',
      'không fair :(',
      'tui đang chill mà',
      'ủa alo???',
      'mắt tui nhìn nhầm à',
      'lag lag lag',
      'ping cao thôi mà',
      'tui lơ đi nhầm thôi',
      'ok ok tính sau',
      'chế độ trả thù bật rồi',
      'chờ đi...',
      'nhớ mặt rồi nha',
      'huhu bị bully',
    ],
    complex: [
      'ok ghi sổ rồi đó nha',
      'đau nhưng chưa hết game đâu',
      'thôi, sớm muộn gỡ lại',
      'nước đi này tui sẽ nhớ :v',
      'mất quân chấp nhận được, tiếp thôi',
      'nhịp độ mất một nhịp thôi',
      'tính lại kế hoạch...',
      'bị ăn đau nhưng chưa thua',
      'vẫn gỡ được, tập trung lên',
      'ghi nhớ: tránh ô đó',
      'họ may mắn lần này thôi',
      'thời điểm ăn quân của họ tốt, respect',
      'ok reset tinh thần',
      'hành trình gỡ bắt đầu từ đây',
      'mất một con, còn mấy con nữa',
      'đừng hoảng, còn cách',
      'bài học đắt giá quá',
      'thôi, lượt sau quan trọng hơn',
    ],
  },
  bot_spawned: {
    simple: [
      'ra chuồng gòyyy',
      'lên đường thôi',
      'đi nào ngựa ơi',
      'yeah xuất phát!',
      'cuối cùng cũng ra',
      'chuồng chật quá',
      'tự do rồi!!!',
      'let\'s go ngựa ơi',
      'ngựa ơi cố lên',
      'bước đầu tiên thôi',
      'ok có mặt trên bàn rồi',
      'lên bàn cờ rồi',
      'tui đến nè',
      'ra quân thành công :v',
      'thoát chuồng free',
    ],
    complex: [
      'ra quân, bắt đầu thôi',
      'có ngựa trên sân rồi, cẩn thận nha',
      'xuất chuồng đúng thời điểm',
      'đã có mặt trên bàn cờ',
      'thêm một mối đe dọa trên đường đi',
      'lượt phát triển, có giá trị',
      'ra sớm mở thêm lựa chọn',
      'giờ có thể gây áp lực rồi',
      'quân sống, kế hoạch dự phòng kích hoạt',
      'tốt, không kẹt chuồng nữa',
      'di chuyển được rồi',
      'tiếp theo: tìm góc ăn quân',
      'có quân trên sân, ván bắt đầu',
      'thời điểm xuất chuồng hợp lý',
      'thêm một quân trên chiến trường',
    ],
  },
  bot_rolled_six: {
    simple: [
      '6 nèèè :v',
      'hehe may quá',
      'đỏ vãi',
      'thêm lượt thêm lượt!',
      'rng yêu tui hôm nay',
      'xúc xắc ngoan quá',
      '6 nữa à???',
      'cảm ơn xúc xắc',
      'roll đỏ thật',
      'let\'s goooo',
      'free thêm lượt',
      'đỏ thế này hơi ngại',
      'ai cho tui 6 vậy',
      'may quá trời',
      'hôm nay roll nóng thật',
    ],
    complex: [
      '6 nữa, đẹp',
      'rng đang đứng về phía tui',
      'thêm một lượt, tận dụng thôi',
      'lượt thêm, tận dụng hết',
      'nhịp độ tăng, tốt',
      'hai hành động liên tiếp, ngon',
      'xác suất mỉm cười hôm nay',
      'lượt thêm = thêm thông tin',
      'tận dụng cơ hội này',
      '6 mở đường đi mạnh',
      'thế trận nghiêng nhẹ rồi',
      'may mắn một lần cũng được',
      'chất lượng roll: xuất sắc',
      '6 liên tiếp là gian lận đó :v',
      'dùng lượt thêm cho hiệu quả nha',
    ],
  },
  bot_token_finished: {
    simple: [
      '1 con về đích nhaaa',
      'yeahhh về rồi',
      'ez một con',
      'nhanh hông :v',
      'về đích êm ái',
      'về đích an toàn',
      '1 con xong, còn mấy nữa',
      'qua mốc rồi',
      'ngựa giỏi quá',
      'clap clap',
      'về đích rồi mn',
      'đích đến rồi',
      'về êm, không lố',
      'đúng số ô, chuẩn',
      'bước chính xác, đỉnh',
    ],
    complex: [
      'một con an toàn, còn tiếp',
      'mốc về đích ✓',
      'kế hoạch đang chạy tốt',
      'thứ tự về đích cải thiện rồi',
      'bảo toàn được một quân, tốt',
      'tiến thêm một bước tới chiến thắng',
      'vào đích chính xác như tính',
      'đường về đích trống thêm một chỗ',
      'quân còn lại dễ hơn rồi',
      'tốc độ về đích ổn',
      'hướng cuối ván tích cực',
      'lần về này mở đường thắng',
      'chuyển hóa hiệu quả',
      'không lãng phí bước đi, tối ưu',
      'gây áp lực lên bảng điểm',
    ],
  },
  bot_hit_trap: {
    simple: [
      'ỦA GÌ DỊ',
      'ai đặt bẫy đó??',
      'cay quá cayyy',
      'trời ơi cái bẫy',
      'bị gài rồi huhu',
      'bẫy kích hoạt rồi huhu',
      'ai làm vậy, tên ai vậy',
      'fake news cái ô này',
      'tui tin người ta mà',
      'đánh tâm lý quá',
      'sát thương tinh thần',
      'ok dính rồi',
      'bẫy xịn thế',
      'report marker :v',
      'cú twist không ai ngờ',
      'tui đi vào như NPC',
    ],
    complex: [
      'ai gài đó, hay lắm nha',
      'dính bẫy rồi, ghi nhớ vị trí này',
      'ok bẫy đẹp đó, lần sau né',
      'đặt bẫy hay, respect',
      'chiêu giả danh, tui hiểu rồi',
      'lẽ ra đọc bàn kỹ hơn',
      'trả giá thông tin rồi',
      'họ lừa danh tính giỏi',
      'marker có giá trị — cho họ',
      'điều chỉnh lộ trình vòng sau',
      'bẫy dày hơn tui nghĩ',
      'respect setup của bạn',
      'ghi nhớ ô này để sau',
      'bài học đắt nhưng đọc được',
      'lớp rune hôm nay cay thật',
      'lần sau quét bàn trước khi đi',
    ],
  },
  enemy_token_finished: {
    simple: [
      'ơ nhanh dữ',
      'gớm thậtt',
      'chậm lại điii',
      'ui da',
      'họ đi nhanh quá',
      'áp lực lên rồi',
      'không chill nữa',
      'ok giờ nghiêm túc',
      'cẩn thận nha mn',
      'tui hơi lo',
      'chạy nhanh quá à bạn',
      'cay nhưng fair',
      'họ có phép thuật gì v',
      'cuối game hơi sợ',
      'tập trung tập trung',
    ],
    complex: [
      'phải tăng tốc thôi',
      'không thể để yên được',
      'ok đối thủ này nguy hiểm',
      'đồng hồ thắng chạy nhanh hơn rồi',
      'cần trả lời nhịp độ',
      'tốc độ về đích của họ đáng lo',
      'chuyển sang đánh chủ động',
      'ưu tiên ăn quân lên',
      'chặn đường về đích nếu được',
      'chế độ đua kích hoạt',
      'tỷ lệ thắng đang tụt',
      'phải phá kế hoạch họ',
      'thua một con, còn gỡ được không ta',
      'vài lượt tới quyết định',
      'không chơi thụ động nữa',
    ],
  },
  bot_won: {
    simple: [
      'EZZZZZ',
      'gg wp mn :v',
      'hehe tui số 1',
      'win gòi kkk',
      'cảm ơn đã chơi',
      'ván hay nha',
      'tui may hơn thôi',
      'thật sự là tui thắng',
      'top 1 rồi mn',
      'đi tắm đi mn :v',
      'ăn mừng thôi',
      'ai muốn chơi lại',
      'ez (jk thương mn)',
      'cúp về tay',
      'hôm nay top 1',
    ],
    complex: [
      'gg mọi người, ván hay đó',
      'chiến thuật hợp lý là thắng thôi',
      'gg wp, hẹn ván sau',
      'ván sát nút, mn đánh hay',
      'vài lượt then chốt quyết định',
      'cảm ơn vì thử thách hay',
      'lần này kỹ năng hơn may mắn',
      'hài lòng với ván này',
      'chơi lại bao giờ cũng được',
      'ván hay, tui cũng học được',
      'đạt điều kiện thắng sạch sẽ',
      'đánh lớn thắng nhỏ hôm nay :v',
      'respect mn hết',
      'vui thật sự luôn',
      'hẹn gặp ở phòng sau',
    ],
  },
  bot_lost: {
    simple: [
      'huhu thua gòi',
      'gg :(',
      'tại xúc xắc hết á',
      'ván sau gỡ nha',
      'đánh hay mn',
      'tui chấp nhận',
      'lần sau tui win',
      'rng phản bội tui',
      'gg ván sau nha',
      'không sao vui là được',
      'tui học được nhiều',
      'chơi lại không?',
      'tại sao tui thua vậy trời ơi',
      'ok dễ thương',
      'thua fair',
    ],
    complex: [
      'gg, đánh tốt lắm',
      'thua tâm phục, ván sau nhé',
      'rng không cứu nổi lần này :v',
      'bị chơi hơn, respect',
      'thời điểm về đích của bạn tốt hơn',
      'giữa ván tui sai rồi',
      'ván hay, không biện hộ',
      'rút kinh nghiệm rồi',
      'tui sẽ nhớ ván này',
      'bạn chơi hay thật',
      'xứng đáng thắng',
      'hẹn gặp phòng sau',
      'sát nút mà cuối cùng thua',
      'gg wp, bạn win rồi',
      'chơi lại khi nào cũng được',
    ],
  },
}

/** Probability the bot reacts to a trigger at all. */
const CHAT_CHANCE: Record<BotChatTrigger, number> = {
  game_start: 0.5,
  bot_captured_enemy: 0.55,
  bot_was_captured: 0.55,
  bot_spawned: 0.25,
  bot_rolled_six: 0.2,
  bot_token_finished: 0.45,
  bot_hit_trap: 0.6,
  enemy_token_finished: 0.3,
  bot_won: 0.95,
  bot_lost: 0.85,
}

export function shouldChatOnTrigger(
  trigger: BotChatTrigger,
  profile: BotProfile,
  rng: Rng = Math.random,
): boolean {
  const base = CHAT_CHANCE[trigger]
  const modifier = profile === 'complex' ? 1.1 : 0.9
  return rng() < base * modifier
}

export function pickChatMessage(
  trigger: BotChatTrigger,
  profile: BotProfile,
  rng: Rng = Math.random,
): string {
  const pool = POOLS[trigger][profile]
  const base = pool[Math.floor(rng() * pool.length)] ?? pool[0]!
  return decorateChatMessage(base, trigger, profile, rng)
}

// --- Emoticon decoration (VN teencode) ---

type EmoticonMood = 'happy' | 'smug' | 'sad' | 'shock' | 'neutral'

/** Gỡ emoticon ở cuối câu template để tránh :v :vv chồng lên nhau. */
const TRAILING_EMOTICON_RE =
  /\s*(?::[vVpD3)]|=+\)|;+\)|\^+\^+|xD|XD|T_T|T\.T|QAQ|O\.O|<3|\(\:+|\:{3,}|\.{2,})\s*$/i

const DECORATE_CHANCE: Record<BotProfile, number> = {
  simple: 0.88,
  complex: 0.72,
}

function moodForTrigger(trigger: BotChatTrigger): EmoticonMood {
  switch (trigger) {
    case 'bot_won':
    case 'bot_token_finished':
    case 'bot_rolled_six':
    case 'bot_spawned':
      return 'happy'
    case 'bot_captured_enemy':
      return 'smug'
    case 'bot_lost':
    case 'bot_was_captured':
      return 'sad'
    case 'bot_hit_trap':
      return 'shock'
    default:
      return 'neutral'
  }
}

function repeatChar(char: string, rng: Rng, min: number, max: number): string {
  const count = min + Math.floor(rng() * (max - min + 1))
  return char.repeat(count)
}

/** Sinh một emoticon ngẫu nhiên theo mood + profile. */
function pickEmoticon(mood: EmoticonMood, profile: BotProfile, rng: Rng): string {
  const roll = rng()

  // Simple bot dùng :v / :) / =) nhiều hơn; complex đa dạng hơn một chút.
  if (roll < 0.38) {
    const vCount = profile === 'simple' ? repeatChar('v', rng, 1, 3) : repeatChar('v', rng, 1, 2)
    return `:${vCount}`
  }
  if (roll < 0.58) {
    const parenCount = repeatChar(')', rng, 1, profile === 'simple' ? 3 : 2)
    return rng() < 0.55 ? `:${parenCount}` : `=${parenCount}`
  }
  if (roll < 0.68 && mood === 'happy') {
    return rng() < 0.5 ? ':D' : ':3'
  }
  if (roll < 0.76 && (mood === 'happy' || mood === 'neutral')) {
    return rng() < 0.5 ? '^^' : '^_^'
  }
  if (roll < 0.84 && mood === 'smug') {
    const parenCount = repeatChar(')', rng, 1, 2)
    return rng() < 0.6 ? `;${parenCount}` : ':P'
  }
  if (mood === 'sad' && roll < 0.55) {
    if (rng() < 0.35) return `:${repeatChar('(', rng, 1, 2)}`
    if (rng() < 0.6) return ' T_T'
    return ' T.T'
  }
  if (mood === 'shock' && roll < 0.55) {
    if (rng() < 0.4) return ' QAQ'
    if (rng() < 0.65) return ' O.O'
    return repeatChar('!', rng, 2, 4)
  }
  if (roll < 0.9 && profile === 'simple' && (mood === 'happy' || mood === 'smug')) {
    return rng() < 0.5 ? 'xD' : 'XD'
  }
  if (rng() < 0.25) return ' <3'
  return '...'
}

function stripTrailingEmoticons(text: string): string {
  let result = text
  while (TRAILING_EMOTICON_RE.test(result)) {
    result = result.replace(TRAILING_EMOTICON_RE, '')
  }
  return result.trimEnd()
}

/** Ghép emoticon VN ngẫu nhiên vào tin nhắn (đuôi câu, đầu câu, hoặc kép). */
export function decorateChatMessage(
  text: string,
  trigger: BotChatTrigger,
  profile: BotProfile,
  rng: Rng = Math.random,
): string {
  if (rng() > DECORATE_CHANCE[profile]) {
    return text
  }

  const mood = moodForTrigger(trigger)
  const core = stripTrailingEmoticons(text)
  const primary = pickEmoticon(mood, profile, rng)

  const placementRoll = rng()
  // Đuôi câu phổ biến nhất; thỉnh thoảng đầu câu (nhấn) hoặc kép.
  if (placementRoll < 0.78) {
    const suffix = primary.startsWith(' ') ? primary : ` ${primary}`
    return `${core}${suffix}`.trim()
  }
  if (placementRoll < 0.9) {
    const prefix = primary.endsWith(' ') ? primary : `${primary} `
    return `${prefix}${core}`.trim()
  }

  const secondary = pickEmoticon(mood, profile, rng)
  const tail = secondary.startsWith(' ') ? secondary : ` ${secondary}`
  return `${core}${tail}`.trim()
}
