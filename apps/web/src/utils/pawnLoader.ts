import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three'

const PAWN_CACHE: { [key: string]: Group } = {}

export async function loadPawnModel(player: number): Promise<Group> {
  const cacheKey = `pawn-${player}`

  if (PAWN_CACHE[cacheKey]) {
    return PAWN_CACHE[cacheKey].clone()
  }

  const pawn = new Group()
  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#facc15']
  const color = colors[player % colors.length]

  const base = new Mesh(
    new CylinderGeometry(0.18, 0.22, 0.1, 16),
    new MeshBasicMaterial({ color: '#f3efe5' }),
  )
  base.position.y = 0.05
  pawn.add(base)

  const body = new Mesh(
    new SphereGeometry(0.17, 18, 16),
    new MeshBasicMaterial({ color }),
  )
  body.position.y = 0.24
  pawn.add(body)

  const neck = new Mesh(
    new CylinderGeometry(0.08, 0.1, 0.12, 12),
    new MeshBasicMaterial({ color: '#f8fafc' }),
  )
  neck.position.y = 0.34
  pawn.add(neck)

  const head = new Mesh(
    new BoxGeometry(0.16, 0.14, 0.12),
    new MeshBasicMaterial({ color: '#ffffff' }),
  )
  head.position.set(0, 0.44, 0.02)
  pawn.add(head)

  pawn.scale.setScalar(0.22)

  PAWN_CACHE[cacheKey] = pawn
  return pawn.clone()
}
