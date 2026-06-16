import type { PlayerColor } from '../types/game.js'

export const DEFAULT_HOUSE_ID = 'house_default' as const

export type HouseSkinId =
  | typeof DEFAULT_HOUSE_ID
  | 'house_cottage'
  | 'house_villa'
  | 'house_manor'

export const HOUSE_SKIN_IDS: HouseSkinId[] = [
  DEFAULT_HOUSE_ID,
  'house_cottage',
  'house_villa',
  'house_manor',
]

export type HouseSkinDefinition = {
  id: HouseSkinId
  name: string
  description: string
  price: number
  sortOrder: number
  /** When true, client loads per-color GLB; otherwise procedural placeholder. */
  hasGlbAsset: boolean
}

export const HOUSE_CATALOG: Record<HouseSkinId, HouseSkinDefinition> = {
  house_default: {
    id: 'house_default',
    name: 'Nhà cổ điển',
    description: 'Ngôi nhà quen thuộc với mái vòm và ống khói — miễn phí cho mọi người chơi.',
    price: 0,
    sortOrder: 0,
    hasGlbAsset: false,
  },
  house_cottage: {
    id: 'house_cottage',
    name: 'Nhà tranh',
    description: 'Mái dốc, hiên cửa ấm cúng — phong cách đồng quê.',
    price: 1000,
    sortOrder: 1,
    hasGlbAsset: false,
  },
  house_villa: {
    id: 'house_villa',
    name: 'Biệt thự',
    description: 'Hai tầng, ban công và cột trụ — sang trọng hơn hẳn.',
    price: 2500,
    sortOrder: 2,
    hasGlbAsset: false,
  },
  house_manor: {
    id: 'house_manor',
    name: 'Lâu đài',
    description: 'Tháp trung tâm, thành lũy và cánh đối xứng — đỉnh cao trang trí.',
    price: 5000,
    sortOrder: 3,
    hasGlbAsset: false,
  },
}

export function isHouseSkinId(value: string): value is HouseSkinId {
  return Object.prototype.hasOwnProperty.call(HOUSE_CATALOG, value)
}

/** GLB path per skin × player color (used when `hasGlbAsset` is true). */
export function getHouseModelPath(skinId: HouseSkinId, color: PlayerColor): string {
  const slug = skinId === DEFAULT_HOUSE_ID ? 'classic' : skinId.replace('house_', '')
  return `/assets/models/houses/${slug}_${color}.glb`
}

export function listShopHouseSkins(): HouseSkinDefinition[] {
  return Object.values(HOUSE_CATALOG).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function isHouseOwnedByDefault(skinId: HouseSkinId): boolean {
  return skinId === DEFAULT_HOUSE_ID
}
