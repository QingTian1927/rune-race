import { useLayoutEffect, useRef } from 'react'
import type { DirectionalLight as DirectionalLightImpl } from 'three'
import { SUN_CONFIG } from './sunConfig'

type SunDirectionalLightProps = {
  shadowsEnabled: boolean
}

const { shadowCamera } = SUN_CONFIG

/**
 * Ensures shadow map + ortho camera are configured after R3F mounts the light.
 */
export function SunDirectionalLight({ shadowsEnabled }: SunDirectionalLightProps) {
  const lightRef = useRef<DirectionalLightImpl>(null)

  useLayoutEffect(() => {
    const light = lightRef.current
    if (!light) {
      return
    }

    light.castShadow = shadowsEnabled

    const shadow = light.shadow
    shadow.mapSize.set(SUN_CONFIG.shadowMapSize, SUN_CONFIG.shadowMapSize)
    shadow.radius = SUN_CONFIG.shadowRadius
    shadow.blurSamples = SUN_CONFIG.shadowBlurSamples
    shadow.bias = SUN_CONFIG.shadowBias
    shadow.normalBias = SUN_CONFIG.shadowNormalBias

    const cam = shadow.camera
    cam.left = shadowCamera.left
    cam.right = shadowCamera.right
    cam.top = shadowCamera.top
    cam.bottom = shadowCamera.bottom
    cam.near = shadowCamera.near
    cam.far = shadowCamera.far
    cam.updateProjectionMatrix()

    shadow.needsUpdate = true
  }, [shadowsEnabled])

  return (
    <directionalLight
      ref={lightRef}
      position={SUN_CONFIG.position}
      intensity={SUN_CONFIG.intensity}
      color={SUN_CONFIG.color}
      castShadow={shadowsEnabled}
    >
      <group attach="target" position={[0, 0.4, 0]} />
    </directionalLight>
  )
}
