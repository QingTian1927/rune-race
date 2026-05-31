import * as THREE from 'three'

const CLOUD_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  fog: true,
})

type PuffSpec = {
  position: [number, number, number]
  scale: [number, number, number]
}

function addPuff(group: THREE.Group, spec: PuffSpec, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), material)
  mesh.position.set(...spec.position)
  mesh.scale.set(...spec.scale)
  mesh.castShadow = false
  mesh.receiveShadow = false
  group.add(mesh)
}

/** Fluffy cloud built from scaled spheres (matches 2D CSS cloud shapes). */
export function createCloudCluster(scale = 1): THREE.Group {
  const group = new THREE.Group()
  const material = CLOUD_MATERIAL.clone()

  const s = scale
  const puffs: PuffSpec[] = [
    { position: [0, 0, 0], scale: [1.15 * s, 0.34 * s, 0.72 * s] },
    { position: [-0.42 * s, 0.2 * s, 0.08 * s], scale: [0.52 * s, 0.48 * s, 0.5 * s] },
    { position: [0.38 * s, 0.16 * s, -0.06 * s], scale: [0.44 * s, 0.4 * s, 0.42 * s] },
    { position: [0.12 * s, 0.32 * s, 0.1 * s], scale: [0.36 * s, 0.34 * s, 0.34 * s] },
  ]

  for (const puff of puffs) {
    addPuff(group, puff, material)
  }

  group.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      ;(node as THREE.Mesh).renderOrder = -5
    }
  })

  return group
}
