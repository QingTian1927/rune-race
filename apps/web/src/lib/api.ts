import { API_BASE } from '../config'

export type PublicRoom = {
  lobbyId: string
  joinCode: string
  name: string
  playerCount: number
  maxPlayers: number
  hasPassword: boolean
  status: string
}

export async function fetchPublicRooms(): Promise<PublicRoom[]> {
  const res = await fetch(`${API_BASE}/api/rooms`)
  if (!res.ok) throw new Error('Failed to load rooms')
  const data = (await res.json()) as { rooms: PublicRoom[] }
  return data.rooms
}

export async function createRoom(params: {
  playerId: string
  playerName: string
  name?: string
  password?: string
}): Promise<{ lobbyId: string; joinCode: string; playerId: string }> {
  const res = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to create room')
  return res.json()
}

export async function resolveRoomByCode(joinCode: string): Promise<{ lobbyId: string }> {
  const res = await fetch(`${API_BASE}/api/rooms/by-code/${encodeURIComponent(joinCode)}`)
  if (!res.ok) throw new Error('Room not found')
  const data = await res.json()
  return { lobbyId: data.lobbyId as string }
}

export async function joinMatchmaking(playerId: string, playerName: string) {
  const res = await fetch(`${API_BASE}/api/matchmaking/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, playerName }),
  })
  if (!res.ok) throw new Error('Matchmaking failed')
  return res.json() as Promise<{
    status: 'idle' | 'queued' | 'matched'
    waitedSeconds: number
    queueSize: number
    lobbyId?: string
    joinCode?: string
  }>
}

export async function leaveMatchmaking(playerId: string) {
  await fetch(`${API_BASE}/api/matchmaking/leave`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  })
}

export async function getMatchmakingStatus(playerId: string) {
  const res = await fetch(
    `${API_BASE}/api/matchmaking/status?playerId=${encodeURIComponent(playerId)}`,
  )
  if (!res.ok) throw new Error('Status check failed')
  return res.json() as Promise<{
    status: 'idle' | 'queued' | 'matched'
    waitedSeconds: number
    queueSize: number
    lobbyId?: string
    joinCode?: string
  }>
}
