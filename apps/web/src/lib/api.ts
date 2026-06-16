import type { HouseSkinDefinition, HouseSkinId } from '@rune-race/shared'
import { API_BASE } from '../config'

export type PublicRoom = {
  lobbyId: string
  joinCode: string
  name: string
  humanPlayerCount: number
  botCount: number
  /** Human players — mirrors humanPlayerCount for compatibility. */
  playerCount: number
  maxPlayers: number
  hasPassword: boolean
  status: string
}

export type Profile = {
  id: string
  display_name: string | null
  phone: string | null
  bio: string | null
  avatar_emoji: string | null
  total_played_seconds: number
  total_games: number
  total_wins: number
  total_losses: number
  coins: number
  equipped_house_id: HouseSkinId
  last_played_at: string | null
}

export type PublicProfile = Omit<Profile, 'phone'>

function authHeaders(accessToken: string | null | undefined): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

function jsonHeaders(accessToken?: string | null) {
  return { 'Content-Type': 'application/json', ...authHeaders(accessToken) }
}

export type FeatureFlags = {
  accountNudgeEnabled: boolean
}

export type PublicSiteBannerPayload = {
  active: boolean
  banner: {
    id: string
    message: string
    linkUrl: string | null
    linkLabel: string
  } | null
}

export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const res = await fetch(`${API_BASE}/api/public/feature-flags`)
  if (!res.ok) throw new Error('Failed to load feature flags')
  return res.json() as Promise<FeatureFlags>
}

export async function fetchSiteBanner(): Promise<PublicSiteBannerPayload> {
  const res = await fetch(`${API_BASE}/api/public/site-banner`)
  if (!res.ok) throw new Error('Failed to load site banner')
  return res.json() as Promise<PublicSiteBannerPayload>
}

export async function fetchPublicRooms(): Promise<PublicRoom[]> {
  const res = await fetch(`${API_BASE}/api/rooms`)
  if (!res.ok) throw new Error('Failed to load rooms')
  const data = (await res.json()) as { rooms: PublicRoom[] }
  return data.rooms
}

export async function createRoom(
  params: {
    playerId: string
    playerName: string
    name?: string
    password?: string
  },
  accessToken?: string | null,
): Promise<{ lobbyId: string; joinCode: string; playerId: string }> {
  const res = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to create room')
  return res.json()
}

export async function resolveRoomByCode(
  joinCode: string,
): Promise<Pick<PublicRoom, 'lobbyId' | 'hasPassword'>> {
  const res = await fetch(`${API_BASE}/api/rooms/by-code/${encodeURIComponent(joinCode)}`)
  if (!res.ok) throw new Error('Room not found')
  const data = (await res.json()) as PublicRoom
  return { lobbyId: data.lobbyId, hasPassword: data.hasPassword }
}

export async function fetchRoomById(lobbyId: string): Promise<PublicRoom> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(lobbyId)}`)
  if (!res.ok) throw new Error('Room not found')
  return res.json() as Promise<PublicRoom>
}

export async function joinMatchmaking(
  playerId: string,
  playerName: string,
  accessToken?: string | null,
) {
  const res = await fetch(`${API_BASE}/api/matchmaking/join`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
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

export async function leaveMatchmaking(playerId: string, accessToken?: string | null) {
  await fetch(`${API_BASE}/api/matchmaking/leave`, {
    method: 'DELETE',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ playerId }),
  })
}

export async function getMatchmakingStatus(playerId: string, accessToken?: string | null) {
  const res = await fetch(
    `${API_BASE}/api/matchmaking/status?playerId=${encodeURIComponent(playerId)}`,
    { headers: authHeaders(accessToken) },
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

export async function updateDisplayName(accessToken: string, displayName: string) {
  const res = await fetch(`${API_BASE}/api/player/display-name`, {
    method: 'PATCH',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ displayName }),
  })
  if (!res.ok) throw new Error('Failed to update display name')
  return res.json() as Promise<{ display_name: string }>
}

export async function fetchProfile(accessToken: string): Promise<Profile> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: authHeaders(accessToken),
  })
  if (res.status === 401) {
    throw new Error('SESSION_EXPIRED')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Failed to load profile')
  }
  return res.json() as Promise<Profile>
}

export async function fetchProfileById(profileId: string): Promise<PublicProfile> {
  const res = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(profileId)}`)
  if (!res.ok) throw new Error('Profile not found')
  return res.json() as Promise<PublicProfile>
}

export async function updateProfile(
  accessToken: string,
  patch: {
    displayName?: string
    bio?: string
    avatarEmoji?: string
    phone?: string
  },
): Promise<Profile> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: 'PATCH',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update profile')
  return res.json() as Promise<Profile>
}

export async function linkAnonProfile(accessToken: string, anonId: string) {
  const res = await fetch(`${API_BASE}/api/auth/link-anon`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ anonId }),
  })
  if (!res.ok) throw new Error('Failed to link anon profile')
  return res.json() as Promise<{ merged: boolean; profile: Profile }>
}

export type ShopInventory = {
  coins: number
  equippedHouseId: HouseSkinId
  ownedHouseIds: HouseSkinId[]
}

export async function fetchShopCatalog(): Promise<{ houses: HouseSkinDefinition[] }> {
  const res = await fetch(`${API_BASE}/api/shop/catalog`)
  if (!res.ok) throw new Error('Failed to load shop catalog')
  return res.json() as Promise<{ houses: HouseSkinDefinition[] }>
}

export async function fetchShopInventory(accessToken: string): Promise<ShopInventory> {
  const res = await fetch(`${API_BASE}/api/shop/inventory`, {
    headers: authHeaders(accessToken),
  })
  if (res.status === 401) throw new Error('SESSION_EXPIRED')
  if (!res.ok) throw new Error('Failed to load shop inventory')
  return res.json() as Promise<ShopInventory>
}

export async function purchaseHouse(accessToken: string, houseId: HouseSkinId): Promise<ShopInventory> {
  const res = await fetch(`${API_BASE}/api/shop/purchase`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ houseId }),
  })
  if (res.status === 401) throw new Error('SESSION_EXPIRED')
  if (res.status === 402) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Insufficient coins')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Purchase failed')
  }
  const data = (await res.json()) as ShopInventory & { purchasedHouseId?: HouseSkinId }
  return {
    coins: data.coins,
    equippedHouseId: data.equippedHouseId,
    ownedHouseIds: data.ownedHouseIds,
  }
}

export async function equipHouse(accessToken: string, houseId: HouseSkinId): Promise<ShopInventory> {
  const res = await fetch(`${API_BASE}/api/shop/equip`, {
    method: 'PATCH',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ houseId }),
  })
  if (res.status === 401) throw new Error('SESSION_EXPIRED')
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Equip failed')
  }
  return res.json() as Promise<ShopInventory>
}

export async function fetchPlayerCosmetics(playerId: string): Promise<{ equippedHouseId: HouseSkinId }> {
  const res = await fetch(`${API_BASE}/api/players/${encodeURIComponent(playerId)}/cosmetics`)
  if (!res.ok) throw new Error('Failed to load player cosmetics')
  return res.json() as Promise<{ equippedHouseId: HouseSkinId }>
}
