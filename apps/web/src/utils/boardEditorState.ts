import { Vector3 } from 'three'

export interface BoardPoint {
  index: number
  x: number
  y: number
  z: number
}

export interface BoxBounds {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

export interface BoardLayoutData {
  meta: {
    version: number
    players: number
    mainTrackSteps: number
    homeLaneStepsPerPlayer: number
    direction: 'ccw' | 'cw'
  }
  mainTrack: BoardPoint[]
  players: Array<{
    player: number
    startIndex: number
    homeEntryIndex: number
    homeLane: BoardPoint[]
    // optional bounding boxes for this player's stable and home areas
    stable?: BoxBounds | null
    home?: BoxBounds | null
  }>
}

export type EditorMode = 'main-track' | 'home-lane' | 'stable' | 'home' | 'select'

export interface EditorState {
  isEditorActive: boolean
  mode: EditorMode
  selectedPlayer: number
  data: BoardLayoutData
  selectedPointId: string | null // format: "main-0" or "home-1-2"
  isDrawingBox: boolean
  boxStartPoint: Vector3 | null
  validationErrors: string[]
}

const DEFAULT_LAYOUT: BoardLayoutData = {
  meta: {
    version: 1,
    players: 4,
    mainTrackSteps: 44,
    homeLaneStepsPerPlayer: 5,
    direction: 'ccw',
  },
  mainTrack: [],
  players: [
    {
      player: 0,
      startIndex: 0,
      homeEntryIndex: 43,
      homeLane: [],
      stable: null,
      home: null,
    },
    {
      player: 1,
      startIndex: 11,
      homeEntryIndex: 10,
      homeLane: [],
      stable: null,
      home: null,
    },
    {
      player: 2,
      startIndex: 22,
      homeEntryIndex: 21,
      homeLane: [],
      stable: null,
      home: null,
    },
    {
      player: 3,
      startIndex: 33,
      homeEntryIndex: 32,
      homeLane: [],
      stable: null,
      home: null,
    },
  ],
}

export const createInitialEditorState = (): EditorState => ({
  isEditorActive: false,
  mode: 'main-track',
  selectedPlayer: 0,
  data: JSON.parse(JSON.stringify(DEFAULT_LAYOUT)),
  selectedPointId: null,
  isDrawingBox: false,
  boxStartPoint: null,
  validationErrors: [],
})

export const validateLayout = (data: BoardLayoutData): string[] => {
  const errors: string[] = []

  if (data.mainTrack.length !== 44) {
    errors.push(`Main track must have exactly 44 steps, got ${data.mainTrack.length}`)
  }

  if (data.players.length !== 4) {
    errors.push(`Must have exactly 4 players, got ${data.players.length}`)
  }

  data.players.forEach((player) => {
    if (player.homeLane.length !== 5) {
      errors.push(
        `Player ${player.player} home lane must have 5 steps, got ${player.homeLane.length}`
      )
    }
  })

  return errors
}

export const exportLayoutJSON = (data: BoardLayoutData): string => {
  return JSON.stringify(data, null, 2)
}

export const importLayoutJSON = (jsonString: string): BoardLayoutData => {
  return JSON.parse(jsonString) as BoardLayoutData
}

export const getPlayerColor = (player: number): string => {
  const colors = ['#0066ff', '#00cc00', '#ff3333', '#ffcc00']
  return colors[player] || '#ffffff'
}

export const getPlayerName = (player: number): string => {
  const names = ['Blue', 'Green', 'Red', 'Yellow']
  return names[player] || 'Unknown'
}
