import { SUN_CONFIG } from './sunConfig'
import { SunDirectionalLight } from './SunDirectionalLight'

type SceneLightingProps = {
  shadowsEnabled: boolean
}

/**
 * Bright outdoor rig — cast shadows readable, not washed out or ragged.
 */
export function SceneLighting({ shadowsEnabled }: SceneLightingProps) {
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
