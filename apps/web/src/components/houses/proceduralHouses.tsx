import type { ReactNode } from 'react'
import * as THREE from 'three'
import type { HouseSkinId } from '@rune-race/shared'

export type HouseBoxBounds = {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
  rotationY?: number
}

export type HouseMaterialSet = {
  wall: ReactNode
  roof: ReactNode
  trim: ReactNode
  door: ReactNode
  window: ReactNode
  accent: ReactNode
}

/** Tiny overlap so adjacent primitives never show a visible seam. */
const SEAM = 0.004

export function buildHouseMaterials(
  color: string,
  {
    cartoonMaterials = true,
    basicMaterials = false,
    gradientMap,
  }: {
    cartoonMaterials?: boolean
    basicMaterials?: boolean
    gradientMap?: THREE.Texture
  },
): HouseMaterialSet {
  const base = new THREE.Color(color)
  const roofColor = base.clone().offsetHSL(0, -0.05, -0.16).getStyle()
  const trimColor = base.clone().offsetHSL(0, -0.2, -0.32).getStyle()
  const doorColor = base.clone().offsetHSL(0, -0.35, -0.42).getStyle()
  const windowColor = base.clone().offsetHSL(0.08, -0.25, 0.28).getStyle()
  const accentColor = base.clone().offsetHSL(0.04, 0.1, -0.08).getStyle()

  const make = (matColor: string) => {
    if (cartoonMaterials) {
      return <meshToonMaterial color={matColor} gradientMap={gradientMap} />
    }
    if (basicMaterials) {
      return <meshBasicMaterial color={matColor} />
    }
    return <meshLambertMaterial color={matColor} />
  }

  return {
    wall: make(color),
    roof: make(roofColor),
    trim: make(trimColor),
    door: make(doorColor),
    window: make(windowColor),
    accent: make(accentColor),
  }
}

type ProceduralHouseProps = {
  w: number
  h: number
  d: number
  mats: HouseMaterialSet
  castShadow: boolean
}

type BoxSpec = {
  size: [number, number, number]
  center: [number, number, number]
  mat: ReactNode
  rotation?: [number, number, number]
}

function topY(centerY: number, height: number) {
  return centerY + height / 2
}

function bottomY(centerY: number, height: number) {
  return centerY - height / 2
}

function stackOn(surfaceY: number, height: number) {
  return surfaceY + height / 2 - SEAM
}

function frontFaceZ(centerZ: number, depth: number) {
  return centerZ + depth / 2
}

function BoxPart({
  size,
  center,
  mat,
  rotation = [0, 0, 0],
  castShadow,
}: BoxSpec & { castShadow: boolean }) {
  return (
    <mesh position={center} rotation={rotation} castShadow={castShadow}>
      <boxGeometry args={size} />
      {mat}
    </mesh>
  )
}

function SolidBox({
  spec,
  castShadow,
}: {
  spec: BoxSpec
  castShadow: boolean
}) {
  return <BoxPart {...spec} castShadow={castShadow} />
}

/** Gable roof prism — base sits flush on `wallTop`. */
function GableRoofPrism({
  wallTop,
  wallWidth,
  wallDepth,
  rise,
  mat,
  castShadow,
}: {
  wallTop: number
  wallWidth: number
  wallDepth: number
  rise: number
  mat: ReactNode
  castShadow: boolean
}) {
  const radius = Math.max(wallWidth, wallDepth) * 0.52
  const centerY = stackOn(wallTop, rise)
  return (
    <mesh position={[0, centerY, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={castShadow}>
      <coneGeometry args={[radius, rise, 4]} />
      {mat}
    </mesh>
  )
}

function WindowInset({
  x,
  centerY,
  wallFrontZ,
  ww,
  wh,
  wd,
  mats,
  castShadow,
  shutters = false,
  sill = false,
}: {
  x: number
  centerY: number
  wallFrontZ: number
  ww: number
  wh: number
  wd: number
  mats: HouseMaterialSet
  castShadow: boolean
  shutters?: boolean
  sill?: boolean
}) {
  const frameDepth = wd * 0.45
  const glassZ = wallFrontZ + wd / 2 - SEAM
  const frameZ = wallFrontZ + frameDepth / 2 - SEAM

  return (
    <group position={[x, centerY, 0]}>
      <SolidBox
        spec={{
          size: [ww, wh, wd],
          center: [0, 0, glassZ],
          mat: mats.window,
        }}
        castShadow={castShadow}
      />
      <SolidBox
        spec={{
          size: [ww + wd * 1.6, wh + wd * 1.6, frameDepth],
          center: [0, 0, frameZ],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />
      {shutters ? (
        <>
          <SolidBox
            spec={{
              size: [ww * 0.34, wh, wd * 0.55],
              center: [-ww * 0.72, 0, glassZ + wd * 0.15],
              mat: mats.accent,
            }}
            castShadow={castShadow}
          />
          <SolidBox
            spec={{
              size: [ww * 0.34, wh, wd * 0.55],
              center: [ww * 0.72, 0, glassZ + wd * 0.15],
              mat: mats.accent,
            }}
            castShadow={castShadow}
          />
        </>
      ) : null}
      {sill ? (
        <SolidBox
          spec={{
            size: [ww + wd * 2, wh * 0.14, wd * 0.9],
            center: [0, -wh / 2 - wh * 0.06, glassZ + wd * 0.12],
            mat: mats.trim,
          }}
          castShadow={castShadow}
        />
      ) : null}
    </group>
  )
}

function DoorInset({
  centerY,
  wallFrontZ,
  dw,
  dh,
  dd,
  mats,
  castShadow,
  frame = true,
  awningWidth,
}: {
  centerY: number
  wallFrontZ: number
  dw: number
  dh: number
  dd: number
  mats: HouseMaterialSet
  castShadow: boolean
  frame?: boolean
  awningWidth?: number
}) {
  const doorZ = wallFrontZ + dd / 2 - SEAM
  const frameDepth = dd * 0.55
  const doorBottom = bottomY(centerY, dh)

  return (
    <group position={[0, centerY, 0]}>
      {frame ? (
        <SolidBox
          spec={{
            size: [dw + dd * 1.4, dh + dd * 1.2, frameDepth],
            center: [0, dd * 0.04, wallFrontZ + frameDepth / 2 - SEAM],
            mat: mats.trim,
          }}
          castShadow={castShadow}
        />
      ) : null}
      <SolidBox
        spec={{
          size: [dw, dh, dd],
          center: [0, 0, doorZ],
          mat: mats.door,
        }}
        castShadow={castShadow}
      />
      <SolidBox
        spec={{
          size: [dw * 0.14, dh * 0.14, dd * 0.35],
          center: [dw * 0.28, dh * 0.08, doorZ + dd * 0.2],
          mat: mats.accent,
        }}
        castShadow={castShadow}
      />
      {awningWidth ? (
        <SolidBox
          spec={{
            size: [awningWidth, dd * 1.4, dd * 2.2],
            center: [0, topY(0, dh) + dd * 0.35, wallFrontZ + dd * 0.95],
            mat: mats.roof,
          }}
          castShadow={castShadow}
        />
      ) : null}
      <SolidBox
        spec={{
          size: [dw * 0.7, dd * 0.55, dd * 0.65],
          center: [0, doorBottom - dd * 0.22, doorZ + dd * 0.25],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />
    </group>
  )
}

function FrontSteps({
  firstStepTopY,
  wallFrontZ,
  stepWidth,
  stepDepth,
  stepHeight,
  count,
  mats,
  castShadow,
}: {
  firstStepTopY: number
  wallFrontZ: number
  stepWidth: number
  stepDepth: number
  stepHeight: number
  count: number
  mats: HouseMaterialSet
  castShadow: boolean
}) {
  let surface = firstStepTopY
  const parts: ReactNode[] = []
  for (let i = 0; i < count; i += 1) {
    const cy = stackOn(surface, stepHeight)
    const z = wallFrontZ + stepDepth * (i + 0.55)
    parts.push(
      <SolidBox
        key={i}
        spec={{
          size: [stepWidth * (1 - i * 0.06), stepHeight, stepDepth],
          center: [0, cy, z],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />,
    )
    surface = topY(cy, stepHeight)
  }
  return <>{parts}</>
}

function BattlementRing({
  roofTopY,
  z,
  span,
  count,
  blockW,
  blockH,
  blockD,
  mat,
  castShadow,
}: {
  roofTopY: number
  z: number
  span: number
  count: number
  blockW: number
  blockH: number
  blockD: number
  mat: ReactNode
  castShadow: boolean
}) {
  const cy = stackOn(roofTopY, blockH)
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2
        return (
          <SolidBox
            key={i}
            spec={{
              size: [blockW, blockH, blockD],
              center: [t * span, cy, z],
              mat,
            }}
            castShadow={castShadow}
          />
        )
      })}
    </>
  )
}

/** Tier 0 — shabby shack; still one cohesive mass, just crude proportions. */
export function ProceduralHouseDefault({ w, h, d, mats, castShadow }: ProceduralHouseProps) {
  const groundY = -h * 0.46
  const baseH = h * 0.09
  const baseCY = groundY + baseH / 2
  const baseTop = topY(baseCY, baseH)

  const wallW = w * 0.74
  const wallH = h * 0.4
  const wallD = d * 0.7
  const wallCY = stackOn(baseTop, wallH)
  const wallTop = topY(wallCY, wallH)
  const wallFront = frontFaceZ(0, wallD)

  const roofH = h * 0.07
  const roofCY = stackOn(wallTop, roofH)

  const patchH = h * 0.13
  const patchCY = wallCY + wallH * 0.12

  const chimneyH = h * 0.14
  const chimneyCY = stackOn(topY(roofCY, roofH), chimneyH)

  return (
    <group>
      <SolidBox
        spec={{
          size: [w * 0.9, baseH, d * 0.86],
          center: [w * 0.02, baseCY, 0],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [wallW, wallH, wallD],
          center: [0, wallCY, 0],
          mat: mats.wall,
        }}
        castShadow={castShadow}
      />

      {/* Patch — embedded in front face, not floating */}
      <SolidBox
        spec={{
          size: [w * 0.2, patchH, SEAM * 4],
          center: [-w * 0.17, patchCY, wallFront - SEAM * 2],
          mat: mats.accent,
        }}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [wallW * 1.04, roofH, wallD * 1.03],
          center: [w * 0.025, roofCY, -d * 0.01],
          mat: mats.roof,
          rotation: [0.06, 0.04, 0.1],
        }}
        castShadow={castShadow}
      />

      <DoorInset
        centerY={wallCY - wallH * 0.06}
        wallFrontZ={wallFront}
        dw={w * 0.14}
        dh={h * 0.19}
        dd={d * 0.028}
        mats={mats}
        castShadow={castShadow}
        frame={false}
      />

      <group position={[-w * 0.19, wallCY + wallH * 0.05, 0]} rotation={[0, 0, 0.1]}>
        <SolidBox
          spec={{
            size: [w * 0.1, h * 0.085, d * 0.022],
            center: [0, 0, wallFront + d * 0.01],
            mat: mats.window,
          }}
          castShadow={castShadow}
        />
        <SolidBox
          spec={{
            size: [w * 0.105, h * 0.01, d * 0.008],
            center: [0, 0, wallFront + d * 0.018],
            mat: mats.trim,
          }}
          castShadow={castShadow}
        />
        <SolidBox
          spec={{
            size: [w * 0.01, h * 0.085, d * 0.008],
            center: [0, 0, wallFront + d * 0.02],
            mat: mats.trim,
          }}
          castShadow={castShadow}
        />
      </group>

      <SolidBox
        spec={{
          size: [w * 0.065, chimneyH, d * 0.065],
          center: [w * 0.2, chimneyCY, -d * 0.12],
          mat: mats.trim,
          rotation: [0.1, 0, -0.14],
        }}
        castShadow={castShadow}
      />
    </group>
  )
}

/** Tier 1 — cottage; foundation → walls → roof → porch as one stack. */
export function ProceduralHouseCottage({ w, h, d, mats, castShadow }: ProceduralHouseProps) {
  const groundY = -h * 0.46
  const baseH = h * 0.1
  const baseCY = groundY + baseH / 2
  const baseTop = topY(baseCY, baseH)

  const wallW = w * 0.84
  const wallH = h * 0.46
  const wallD = d * 0.76
  const wallCY = stackOn(baseTop, wallH)
  const wallTop = topY(wallCY, wallH)
  const wallFront = frontFaceZ(0, wallD)

  const roofRise = h * 0.32
  const roofTop = wallTop + roofRise - SEAM

  const porchDepth = d * 0.2
  const porchH = h * 0.045
  const porchCY = stackOn(baseTop, porchH)
  const porchTop = topY(porchCY, porchH)
  const porchZ = wallFront + porchDepth / 2

  const columnH = topY(wallCY, wallH * 0.15) - porchTop
  const columnCY = porchTop + columnH / 2

  const chimneyH = h * 0.16
  const chimneyCY = stackOn(roofTop, chimneyH)

  return (
    <group>
      <SolidBox
        spec={{
          size: [w * 0.94, baseH, d * 0.9],
          center: [0, baseCY, 0],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [wallW, wallH, wallD],
          center: [0, wallCY, 0],
          mat: mats.wall,
        }}
        castShadow={castShadow}
      />

      <GableRoofPrism
        wallTop={wallTop}
        wallWidth={wallW}
        wallDepth={wallD}
        rise={roofRise}
        mat={mats.roof}
        castShadow={castShadow}
      />

      {/* Fascia band — bottom edge on wall top */}
      <SolidBox
        spec={{
          size: [wallW * 1.02, h * 0.035, wallD * 0.08],
          center: [0, stackOn(wallTop, h * 0.035), wallFront - wallD * 0.04],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [w * 0.58, porchH, porchDepth],
          center: [0, porchCY, porchZ],
          mat: mats.accent,
        }}
        castShadow={castShadow}
      />

      {[-w * 0.21, w * 0.21].map((x) => (
        <SolidBox
          key={x}
          spec={{
            size: [w * 0.05, columnH, d * 0.05],
            center: [x, columnCY, porchZ + porchDepth * 0.15],
            mat: mats.trim,
          }}
          castShadow={castShadow}
        />
      ))}

      <DoorInset
        centerY={wallCY - wallH * 0.04}
        wallFrontZ={wallFront}
        dw={w * 0.16}
        dh={h * 0.23}
        dd={d * 0.034}
        mats={mats}
        castShadow={castShadow}
        awningWidth={w * 0.4}
      />

      <WindowInset
        x={-w * 0.23}
        centerY={wallCY + wallH * 0.06}
        wallFrontZ={wallFront}
        ww={w * 0.12}
        wh={h * 0.1}
        wd={d * 0.026}
        mats={mats}
        castShadow={castShadow}
        shutters
        sill
      />
      <WindowInset
        x={w * 0.23}
        centerY={wallCY + wallH * 0.06}
        wallFrontZ={wallFront}
        ww={w * 0.12}
        wh={h * 0.1}
        wd={d * 0.026}
        mats={mats}
        castShadow={castShadow}
        shutters
        sill
      />

      <FrontSteps
        firstStepTopY={baseTop}
        wallFrontZ={wallFront + porchDepth}
        stepWidth={w * 0.32}
        stepDepth={d * 0.085}
        stepHeight={h * 0.045}
        count={2}
        mats={mats}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [w * 0.08, chimneyH, d * 0.08],
          center: [w * 0.24, chimneyCY, -d * 0.1],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />
    </group>
  )
}

/** Tier 2 — villa; lower and upper block share a flush seam. */
export function ProceduralHouseVilla({ w, h, d, mats, castShadow }: ProceduralHouseProps) {
  const groundY = -h * 0.46
  const baseH = h * 0.11
  const baseCY = groundY + baseH / 2
  const baseTop = topY(baseCY, baseH)

  const lowW = w * 0.88
  const lowH = h * 0.36
  const lowD = d * 0.8
  const lowCY = stackOn(baseTop, lowH)
  const lowTop = topY(lowCY, lowH)
  const lowFront = frontFaceZ(0, lowD)

  const upW = w * 0.72
  const upH = h * 0.26
  const upD = d * 0.66
  const upCY = stackOn(lowTop, upH)
  const upTop = topY(upCY, upH)
  const upFront = frontFaceZ(-d * 0.02, upD)

  const corniceH = h * 0.045
  const corniceCY = stackOn(upTop, corniceH)
  const corniceTop = topY(corniceCY, corniceH)

  const roofH = h * 0.042
  const roofCY = stackOn(corniceTop, roofH)

  const columnH = upTop - baseTop
  const columnCY = baseTop + columnH / 2

  return (
    <group>
      <SolidBox
        spec={{
          size: [w * 0.96, baseH, d * 0.92],
          center: [0, baseCY, 0],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [lowW, lowH, lowD],
          center: [0, lowCY, 0],
          mat: mats.wall,
        }}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [upW, upH, upD],
          center: [0, upCY, -d * 0.02],
          mat: mats.accent,
        }}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [upW * 1.04, corniceH, upD * 1.04],
          center: [0, corniceCY, -d * 0.02],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [upW * 1.06, roofH, upD * 1.06],
          center: [0, roofCY, 0],
          mat: mats.roof,
        }}
        castShadow={castShadow}
      />

      {[-w * 0.19, w * 0.19].map((x) => (
        <SolidBox
          key={x}
          spec={{
            size: [w * 0.06, columnH, d * 0.06],
            center: [x, columnCY, lowFront + d * 0.02],
            mat: mats.trim,
          }}
          castShadow={castShadow}
        />
      ))}

      <DoorInset
        centerY={lowCY - lowH * 0.05}
        wallFrontZ={lowFront}
        dw={w * 0.18}
        dh={h * 0.24}
        dd={d * 0.038}
        mats={mats}
        castShadow={castShadow}
      />

      {/* Pediment — base flush on door lintel */}
      <mesh
        position={[0, lowCY + lowH * 0.06 + h * 0.045, lowFront + d * 0.022]}
        castShadow={castShadow}
      >
        <coneGeometry args={[w * 0.14, h * 0.09, 3]} />
        {mats.trim}
      </mesh>

      <WindowInset
        x={-w * 0.19}
        centerY={upCY}
        wallFrontZ={upFront}
        ww={w * 0.1}
        wh={h * 0.09}
        wd={d * 0.026}
        mats={mats}
        castShadow={castShadow}
        sill
      />
      <WindowInset
        x={w * 0.19}
        centerY={upCY}
        wallFrontZ={upFront}
        ww={w * 0.1}
        wh={h * 0.09}
        wd={d * 0.026}
        mats={mats}
        castShadow={castShadow}
        sill
      />

      {/* Balcony slab flush with upper floor */}
      <SolidBox
        spec={{
          size: [upW * 0.78, h * 0.03, d * 0.065],
          center: [0, bottomY(upCY, upH) + h * 0.015, upFront - upD * 0.02],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />

      {[-0.22, -0.11, 0, 0.11, 0.22].map((t) => (
        <SolidBox
          key={t}
          spec={{
            size: [w * 0.022, h * 0.09, d * 0.022],
            center: [w * t, upCY + upH * 0.08, upFront + d * 0.01],
            mat: mats.trim,
          }}
          castShadow={castShadow}
        />
      ))}

      <WindowInset
        x={-w * 0.29}
        centerY={lowCY + lowH * 0.02}
        wallFrontZ={lowFront}
        ww={w * 0.09}
        wh={h * 0.09}
        wd={d * 0.024}
        mats={mats}
        castShadow={castShadow}
        shutters
      />
      <WindowInset
        x={w * 0.29}
        centerY={lowCY + lowH * 0.02}
        wallFrontZ={lowFront}
        ww={w * 0.09}
        wh={h * 0.09}
        wd={d * 0.024}
        mats={mats}
        castShadow={castShadow}
        shutters
      />

      <FrontSteps
        firstStepTopY={baseTop}
        wallFrontZ={lowFront}
        stepWidth={w * 0.46}
        stepDepth={d * 0.09}
        stepHeight={h * 0.042}
        count={3}
        mats={mats}
        castShadow={castShadow}
      />
    </group>
  )
}

/** Tier 3 — manor; wings overlap keep, all roofs and battlements sit on surfaces. */
export function ProceduralHouseManor({ w, h, d, mats, castShadow }: ProceduralHouseProps) {
  const groundY = -h * 0.46
  const baseH = h * 0.12
  const baseCY = groundY + baseH / 2
  const baseTop = topY(baseCY, baseH)

  const wingW = w * 0.28
  const wingH = h * 0.42
  const wingD = d * 0.72
  const wingCY = stackOn(baseTop, wingH)
  const wingTop = topY(wingCY, wingH)
  const wingFront = frontFaceZ(0, wingD)

  const keepW = w * 0.36
  const keepH = h * 0.64
  const keepD = d * 0.56
  const keepCY = stackOn(baseTop, keepH)
  const keepTop = topY(keepCY, keepH)
  const keepFront = frontFaceZ(-d * 0.02, keepD)

  const wingX = keepW / 2 + wingW / 2 - w * 0.03

  const wingRoofH = h * 0.048
  const wingRoofCY = stackOn(wingTop, wingRoofH)
  const wingRoofTop = topY(wingRoofCY, wingRoofH)

  const keepRoofRise = h * 0.24
  const keepRoofTop = keepTop + keepRoofRise - SEAM

  const turretR = w * 0.065
  const turretH = h * 0.46
  const turretConeH = h * 0.14
  const turretX = w * 0.36

  const blockW = w * 0.05
  const blockH = h * 0.06
  const blockD = d * 0.05

  const flagPoleH = h * 0.18
  const flagPoleCY = stackOn(keepRoofTop, flagPoleH)

  return (
    <group>
      <SolidBox
        spec={{
          size: [w * 0.98, baseH, d * 0.94],
          center: [0, baseCY, 0],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />

      {[-wingX, wingX].map((x) => (
        <group key={x}>
          <SolidBox
            spec={{
              size: [wingW, wingH, wingD],
              center: [x, wingCY, 0],
              mat: mats.wall,
            }}
            castShadow={castShadow}
          />
          <SolidBox
            spec={{
              size: [wingW * 1.04, wingRoofH, wingD * 1.04],
              center: [x, wingRoofCY, 0],
              mat: mats.roof,
            }}
            castShadow={castShadow}
          />
          <BattlementRing
            roofTopY={wingRoofTop}
            z={frontFaceZ(0, wingD) - wingD * 0.06}
            span={wingW * 0.55}
            count={3}
            blockW={blockW}
            blockH={blockH}
            blockD={blockD}
            mat={mats.trim}
            castShadow={castShadow}
          />
          <WindowInset
            x={x}
            centerY={wingCY + wingH * 0.04}
            wallFrontZ={wingFront}
            ww={w * 0.085}
            wh={h * 0.09}
            wd={d * 0.024}
            mats={mats}
            castShadow={castShadow}
            sill
          />
        </group>
      ))}

      <SolidBox
        spec={{
          size: [keepW, keepH, keepD],
          center: [0, keepCY, -d * 0.02],
          mat: mats.accent,
        }}
        castShadow={castShadow}
      />

      <GableRoofPrism
        wallTop={keepTop}
        wallWidth={keepW}
        wallDepth={keepD}
        rise={keepRoofRise}
        mat={mats.roof}
        castShadow={castShadow}
      />

      <BattlementRing
        roofTopY={keepTop}
        z={frontFaceZ(-d * 0.02, keepD) - keepD * 0.04}
        span={keepW * 0.62}
        count={5}
        blockW={blockW}
        blockH={blockH}
        blockD={blockD}
        mat={mats.trim}
        castShadow={castShadow}
      />

      {[-turretX, turretX].map((x) => {
        const cylCY = stackOn(wingRoofTop, turretH)
        const cylTop = topY(cylCY, turretH)
        const coneCY = stackOn(cylTop, turretConeH)
        return (
          <group key={x}>
            <mesh position={[x, cylCY, -d * 0.2]} castShadow={castShadow}>
              <cylinderGeometry args={[turretR, turretR * 1.04, turretH, 10]} />
              {mats.wall}
            </mesh>
            <mesh position={[x, coneCY, -d * 0.2]} castShadow={castShadow}>
              <coneGeometry args={[turretR * 1.12, turretConeH, 10]} />
              {mats.roof}
            </mesh>
          </group>
        )
      })}

      <SolidBox
        spec={{
          size: [w * 0.2, h * 0.3, d * 0.06],
          center: [0, keepCY - keepH * 0.12, keepFront + d * 0.02],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />

      <DoorInset
        centerY={keepCY - keepH * 0.14}
        wallFrontZ={keepFront}
        dw={w * 0.14}
        dh={h * 0.26}
        dd={d * 0.042}
        mats={mats}
        castShadow={castShadow}
      />

      <FrontSteps
        firstStepTopY={baseTop}
        wallFrontZ={keepFront}
        stepWidth={w * 0.52}
        stepDepth={d * 0.1}
        stepHeight={h * 0.04}
        count={4}
        mats={mats}
        castShadow={castShadow}
      />

      <SolidBox
        spec={{
          size: [w * 0.022, flagPoleH, d * 0.022],
          center: [0, flagPoleCY, keepFront - keepD * 0.15],
          mat: mats.trim,
        }}
        castShadow={castShadow}
      />
      <SolidBox
        spec={{
          size: [w * 0.12, h * 0.07, d * 0.012],
          center: [w * 0.06, topY(flagPoleCY, flagPoleH) - h * 0.02, keepFront - keepD * 0.15],
          mat: mats.wall,
        }}
        castShadow={castShadow}
      />
    </group>
  )
}

const PROCEDURAL_BY_SKIN: Record<HouseSkinId, (props: ProceduralHouseProps) => ReactNode> = {
  house_default: ProceduralHouseDefault,
  house_cottage: ProceduralHouseCottage,
  house_villa: ProceduralHouseVilla,
  house_manor: ProceduralHouseManor,
}

export function ProceduralHouseBySkin({
  skinId,
  ...props
}: ProceduralHouseProps & { skinId: HouseSkinId }) {
  const Component = PROCEDURAL_BY_SKIN[skinId]
  return <Component {...props} />
}
