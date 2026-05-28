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

export type Profile = {
  id: string
  display_name: string | null
  bio: string | null
  avatar_emoji: string | null
  phone: string | null
  xp: number
  coins: number
  items: unknown
  is_anon: boolean
  total_played_hours: number
  total_games: number
  total_wins: number
  total_losses: number
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchProfile(accessToken: string): Promise<Profile> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: { ...authHeaders(accessToken) },
  })
  if (!res.ok) throw new Error('Failed to load profile')
  return res.json() as Promise<Profile>
}

export async function fetchProfileById(profileId: string): Promise<Profile> {
  const res = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(profileId)}`)
  if (!res.ok) throw new Error('Profile not found')
  return res.json() as Promise<Profile>
}

export async function updateProfile(
  accessToken: string,
  patch: { displayName?: string; bio?: string; avatarEmoji?: string; phone?: string },
): Promise<Profile> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update profile')
  return res.json() as Promise<Profile>
}

export async function linkAnonProfile(accessToken: string, anonId: string) {
  const res = await fetch(`${API_BASE}/api/auth/link-anon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
    body: JSON.stringify({ anonId }),
  })
  if (!res.ok) throw new Error('Failed to link anon profile')
  return res.json() as Promise<{ merged: boolean; profile: Profile }>
}
