import { SUN_CONFIG } from './sunConfig'
import { SunDirectionalLight } from './SunDirectionalLight'

type SceneLightingProps = {
  shadowsEnabled: boolean
  richLighting: boolean
  minimalLighting: boolean
}

/**
 * Bright outdoor rig — cast shadows readable, not washed out or ragged.
 */
export function SceneLighting({
  shadowsEnabled,
  richLighting,
  minimalLighting,
}: SceneLightingProps) {
  if (richLighting) {
    return (
      <>
        <ambientLight
          intensity={SUN_CONFIG.ambient.intensity}
          color={SUN_CONFIG.ambient.color}
        />
        <hemisphereLight
          color={SUN_CONFIG.hemisphere.sky}
          groundColor={SUN_CONFIG.hemisphere.ground}
          intensity={SUN_CONFIG.hemisphere.intensity}
        />
        <SunDirectionalLight shadowsEnabled={shadowsEnabled} />
        <directionalLight
          position={SUN_CONFIG.fill.position}
          intensity={SUN_CONFIG.fill.intensity}
          color={SUN_CONFIG.fill.color}
        />
      </>
    )
  }

  if (minimalLighting) {
    /** Cheapest lit look — basic materials are unlit; this still helps any leftover lit meshes. */
    return (
      <>
        <ambientLight intensity={1.65} color="#fffef8" />
        <directionalLight
          position={SUN_CONFIG.position}
          intensity={0.85}
          color={SUN_CONFIG.color}
        />
      </>
    )
  }

  return (
    <>
      <ambientLight intensity={1.42} color="#fffef5" />
      <hemisphereLight
        color={SUN_CONFIG.hemisphere.sky}
        groundColor={SUN_CONFIG.hemisphere.ground}
        intensity={0.88}
      />
      <directionalLight
        position={SUN_CONFIG.position}
        intensity={1.12}
        color={SUN_CONFIG.color}
      />
      <directionalLight
        position={SUN_CONFIG.fill.position}
        intensity={0.52}
        color={SUN_CONFIG.fill.color}
      />
    </>
  )
}
