import { PROFILE_EMOJIS } from './profileEmojis'

export type FakeLeaderboardSeedEntry = {
  id: string
  name: string
  emoji: string
  baseScore: number
  baseCoins: number
  /** Points gained per simulated minute (long-term drift). */
  scoreDriftPerMin: number
  /** Coins gained per simulated minute. */
  coinDriftPerMin: number
}

/** Fixed epoch anchor so scores grow realistically between visits. */
export const LEADERBOARD_EPOCH_START_MS = Date.parse('2026-01-15T00:00:00+07:00')

/** Always locked to ranks 1–3 in display order (Ngọc Diệp, Huy Hoàng, Cẩm Nhung). */
export const PINNED_TOP_PLAYER_IDS = ['p01', 'p02', 'p03'] as const

/** Names from EXE plan.xlsx (Campus Challenge registrations); top 3 fixed by rank. */
const RAW_SEEDS: Omit<FakeLeaderboardSeedEntry, 'emoji'>[] = [
  { id: 'p01', name: 'Ngọc Diệp', baseScore: 842, baseCoins: 320, scoreDriftPerMin: 0.28, coinDriftPerMin: 0.045 },
  { id: 'p02', name: 'Huy Hoàng', baseScore: 815, baseCoins: 410, scoreDriftPerMin: 0.25, coinDriftPerMin: 0.052 },
  { id: 'p03', name: 'Cẩm Nhung', baseScore: 798, baseCoins: 280, scoreDriftPerMin: 0.26, coinDriftPerMin: 0.038 },
  { id: 'p04', name: 'Nguyễn Thị Việt Hà', baseScore: 772, baseCoins: 360, scoreDriftPerMin: 0.24, coinDriftPerMin: 0.041 },
  { id: 'p05', name: 'Bùi Hoàng An', baseScore: 754, baseCoins: 295, scoreDriftPerMin: 0.23, coinDriftPerMin: 0.036 },
  { id: 'p06', name: 'Nguyễn Văn Cảnh', baseScore: 731, baseCoins: 220, scoreDriftPerMin: 0.27, coinDriftPerMin: 0.048 },
  { id: 'p07', name: 'Mai Việt Huy', baseScore: 708, baseCoins: 510, scoreDriftPerMin: 0.22, coinDriftPerMin: 0.055 },
  { id: 'p08', name: 'Nghiêm Sơn Hoàng', baseScore: 689, baseCoins: 190, scoreDriftPerMin: 0.25, coinDriftPerMin: 0.033 },
  { id: 'p09', name: 'Phan Minh Đông', baseScore: 665, baseCoins: 340, scoreDriftPerMin: 0.24, coinDriftPerMin: 0.044 },
  { id: 'p10', name: 'Nguyễn Hương Trà', baseScore: 642, baseCoins: 260, scoreDriftPerMin: 0.26, coinDriftPerMin: 0.039 },
  { id: 'p11', name: 'Thii Thii', baseScore: 618, baseCoins: 175, scoreDriftPerMin: 0.28, coinDriftPerMin: 0.031 },
  { id: 'p12', name: 'Vũ Hương Quỳnh', baseScore: 595, baseCoins: 420, scoreDriftPerMin: 0.21, coinDriftPerMin: 0.05 },
  { id: 'p13', name: 'Nguyễn Quỳnh Như', baseScore: 571, baseCoins: 210, scoreDriftPerMin: 0.25, coinDriftPerMin: 0.035 },
  { id: 'p14', name: 'Nguyễn Đức Hùng', baseScore: 548, baseCoins: 380, scoreDriftPerMin: 0.23, coinDriftPerMin: 0.042 },
  { id: 'p15', name: 'Ngô Kim Ngân', baseScore: 524, baseCoins: 160, scoreDriftPerMin: 0.27, coinDriftPerMin: 0.029 },
  { id: 'p16', name: 'Huy Hưng', baseScore: 501, baseCoins: 290, scoreDriftPerMin: 0.24, coinDriftPerMin: 0.037 },
  { id: 'p17', name: 'Lê Thế Linh', baseScore: 478, baseCoins: 240, scoreDriftPerMin: 0.26, coinDriftPerMin: 0.034 },
  { id: 'p18', name: 'Mai Ngọc Linh', baseScore: 452, baseCoins: 450, scoreDriftPerMin: 0.2, coinDriftPerMin: 0.058 },
  { id: 'p19', name: 'Lê Tùng Lâm', baseScore: 429, baseCoins: 130, scoreDriftPerMin: 0.25, coinDriftPerMin: 0.027 },
  { id: 'p20', name: 'Nguyễn Anh Khoa', baseScore: 405, baseCoins: 200, scoreDriftPerMin: 0.23, coinDriftPerMin: 0.032 },
]

export const FAKE_LEADERBOARD_SEED: FakeLeaderboardSeedEntry[] = RAW_SEEDS.map((entry, index) => ({
  ...entry,
  emoji: PROFILE_EMOJIS[index % PROFILE_EMOJIS.length]!,
}))
