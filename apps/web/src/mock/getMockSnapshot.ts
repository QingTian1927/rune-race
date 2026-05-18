import type { GameState, Player, Token, Turn, PlayerColor } from '@rune-race/shared'
import { PLAYER_COLORS } from '@rune-race/shared'
import boardLayout from '../../data/board-layout.json'

/**
 * Get a mock GameState snapshot for development and testing.
 * Includes 4 players with token distribution:
 * - 2 tokens in_base
 * - 1 token on_track at a random position (unique per player)
 * - 1 token finished
 */
export default function getMockSnapshot(): GameState {
  const mainTrackLength = boardLayout.meta.mainTrackSteps
  const homeLaneEndIndex = boardLayout.meta.homeLaneStepsPerPlayer - 1

  // Create players
  const players: Player[] = PLAYER_COLORS.slice(0, 4).map((color: PlayerColor) => ({
    id: `player-${color}`,
    name: `Player ${color.charAt(0).toUpperCase() + color.slice(1)}`,
    color,
  }))

  // Create tokens with specified distribution
  const tokens: Token[] = []
  const usedPositions = new Set<number>()

  players.forEach((player, _playerIndex) => {
    // Token 0: in_base
    tokens.push({
      id: `${player.id}:0`,
      playerId: player.id,
      position: 0,
      state: 'in_base',
    })

    // Token 1: in_base
    tokens.push({
      id: `${player.id}:1`,
      playerId: player.id,
      position: 1,
      state: 'in_base',
    })

    // Token 2: on_track with unique random position
    let position: number
    do {
      position = Math.floor(Math.random() * mainTrackLength)
    } while (usedPositions.has(position))
    usedPositions.add(position)

    tokens.push({
      id: `${player.id}:2`,
      playerId: player.id,
      position,
      state: 'on_track',
    })

    // Token 3: in_home_lane at a random home lane index
    const hlLength = boardLayout.players[_playerIndex]?.homeLane?.length ?? (homeLaneEndIndex + 1)
    const homePos = Math.floor(Math.random() * Math.max(1, hlLength))
    tokens.push({
      id: `${player.id}:3`,
      playerId: player.id,
      position: homePos,
      state: 'in_home_lane',
    })
  })

  // Create a mock turn
  const currentPlayerId = players[0].id
  const turn: Turn = {
    id: 'mock-turn-1',
    currentPlayerId,
    diceResult: null,
    phase: 'waiting_roll',
    legalMoves: [],
    startTime: Date.now(),
  }

  // Assemble game state
  const gameState: GameState = {
    roomId: 'mock-room',
    version: 1,
    players,
    tokens,
    turn,
    phase: 'waiting_roll',
    status: 'playing',
    currentPlayerIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    events: [],
  }

  return gameState
}
