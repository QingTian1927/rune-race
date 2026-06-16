import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  DEFAULT_HOUSE_ID,
  getHouseModelPath,
  HOUSE_CATALOG,
  type HouseSkinId,
  type PlayerColor,
} from '@rune-race/shared'
import { getBoardGradientMap } from '../../lib/sceneMaterials'
import {
  buildHouseMaterials,
  ProceduralHouseBySkin,
  type HouseBoxBounds,
} from './proceduralHouses'
import { normalizeHouseGlb } from '../../utils/houseLoader'

const PLAYER_COLOR_HEX: Record<PlayerColor, string> = {
  red: '#FF6B60',
  blue: '#5BA8FF',
  green: '#4FC870',
  yellow: '#FFD740',
}

type HouseModelProps = {
  box: HouseBoxBounds | null | undefined
  skinId?: HouseSkinId
  color?: PlayerColor
  cartoonMaterials?: boolean
  basicMaterials?: boolean
  castShadow?: boolean
}

function GlbHouseInstance({
  modelPath,
  box,
  color,
  cartoonMaterials = true,
  basicMaterials = false,
  castShadow = true,
}: {
  modelPath: string
  box: HouseBoxBounds
  color: PlayerColor
  cartoonMaterials?: boolean
  basicMaterials?: boolean
  castShadow?: boolean
}) {
  const scene = useGLTF(modelPath).scene
  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const w = box.maxX - box.minX
  const h = box.maxY - box.minY
  const d = box.maxZ - box.minZ

  const normalized = useMemo(
    () =>
      normalizeHouseGlb(scene, {
        targetSize: { x: w, y: h, z: d },
        tintHex: PLAYER_COLOR_HEX[color],
        castShadow,
        cartoonMaterials,
        basicMaterials,
      }),
    [basicMaterials, cartoonMaterials, castShadow, color, d, h, scene, w],
  )

  return (
    <group position={[cx, cy, cz]} rotation-y={box.rotationY ?? 0}>
      <primitive object={normalized} />
    </group>
  )
}

export default function HouseModel({
  box,
  skinId = DEFAULT_HOUSE_ID,
  color = 'red',
  cartoonMaterials = true,
  basicMaterials = false,
  castShadow = true,
}: HouseModelProps) {
  if (!box) return null

  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const w = box.maxX - box.minX
  const h = box.maxY - box.minY
  const d = box.maxZ - box.minZ
  const tint = PLAYER_COLOR_HEX[color]
  const gradientMap = cartoonMaterials ? getBoardGradientMap() : undefined
  const mats = useMemo(
    () => buildHouseMaterials(tint, { cartoonMaterials, basicMaterials, gradientMap }),
    [basicMaterials, cartoonMaterials, gradientMap, tint],
  )

  const catalog = HOUSE_CATALOG[skinId] ?? HOUSE_CATALOG[DEFAULT_HOUSE_ID]
  if (catalog.hasGlbAsset) {
    const modelPath = getHouseModelPath(skinId, color)
    return (
      <GlbHouseInstance
        modelPath={modelPath}
        box={box}
        color={color}
        cartoonMaterials={cartoonMaterials}
        basicMaterials={basicMaterials}
        castShadow={castShadow}
      />
    )
  }

  return (
    <group position={[cx, cy, cz]} rotation-y={box.rotationY ?? 0}>
      <ProceduralHouseBySkin
        skinId={skinId}
        w={w}
        h={h}
        d={d}
        mats={mats}
        castShadow={castShadow}
      />
    </group>
  )
}

export function HousePreviewModel({
  skinId,
  color,
  cartoonMaterials = true,
}: {
  skinId: HouseSkinId
  color: PlayerColor
  cartoonMaterials?: boolean
}) {
  const previewBox: HouseBoxBounds = {
    minX: -0.5,
    minY: 0,
    minZ: -0.5,
    maxX: 0.5,
    maxY: 0.55,
    maxZ: 0.5,
    rotationY: 0,
  }

  return (
    <HouseModel
      box={previewBox}
      skinId={skinId}
      color={color}
      cartoonMaterials={cartoonMaterials}
      castShadow={false}
    />
  )
}
