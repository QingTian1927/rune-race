import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

type SceneRendererSetupProps = {
  shadowsEnabled: boolean
  toneMappingEnabled: boolean
}

export function SceneRendererSetup({
  shadowsEnabled,
  toneMappingEnabled,
}: SceneRendererSetupProps) {
  const gl = useThree((state) => state.gl)

  useLayoutEffect(() => {
    gl.shadowMap.enabled = shadowsEnabled
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = toneMappingEnabled ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
    gl.toneMappingExposure = toneMappingEnabled ? 1.32 : 1
    gl.outputColorSpace = THREE.SRGBColorSpace
  }, [gl, shadowsEnabled, toneMappingEnabled])

  return null
}
