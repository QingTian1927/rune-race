import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

type SceneRendererSetupProps = {
  shadowsEnabled: boolean
}

export function SceneRendererSetup({ shadowsEnabled }: SceneRendererSetupProps) {
  const gl = useThree((state) => state.gl)

  useLayoutEffect(() => {
    gl.shadowMap.enabled = shadowsEnabled
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.32
    gl.outputColorSpace = THREE.SRGBColorSpace
  }, [gl, shadowsEnabled])

  return null
}
