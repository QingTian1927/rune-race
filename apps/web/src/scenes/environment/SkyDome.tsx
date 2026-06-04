import { useMemo } from 'react'
import * as THREE from 'three'

const SKY_TOP = new THREE.Color('#8ed4ff')
const SKY_MID = new THREE.Color('#cce8ff')
const SKY_HORIZON = new THREE.Color('#fff6e4')

const skyVertexShader = /* glsl */ `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const skyFragmentShader = /* glsl */ `
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 horizonColor;

varying vec3 vWorldPosition;

void main() {
  float h = normalize(vWorldPosition).y;
  float t = clamp((h + 0.05) / 0.85, 0.0, 1.0);
  vec3 color = mix(horizonColor, midColor, smoothstep(0.0, 0.45, t));
  color = mix(color, topColor, smoothstep(0.35, 1.0, t));
  gl_FragColor = vec4(color, 1.0);
}
`

type SkyDomeProps = {
  enabled?: boolean
}

export function SkyDome({ enabled = true }: SkyDomeProps) {
  const material = useMemo(() => {
    const shader = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: SKY_TOP },
        midColor: { value: SKY_MID },
        horizonColor: { value: SKY_HORIZON },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    return shader
  }, [])

  if (!enabled) {
    return null
  }

  return (
    <mesh material={material} renderOrder={-20} frustumCulled={false}>
      <sphereGeometry args={[90, 32, 24]} />
    </mesh>
  )
}
