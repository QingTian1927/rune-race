/**
 * Rune system domain types (Rule Lock v1.1).
 */

export const RUNE_CARD_TYPES = [
  'LEAVE_STABLE',
  'SHIELD',
  'ADVANCE_2',
  'ADVANCE_3',
  'ADVANCE_4',
  'BACK_3',
  'BACK_4',
  'BACK_5',
  'FREEZE',
  'SEND_HOME',
  'SWAP',
] as const

export type RuneCardType = (typeof RUNE_CARD_TYPES)[number]

export type RuneCardCategory = 'SUPPORT' | 'TRAP' | 'SPECIAL'

export type RuneTriggerMode = 'PASS_THROUGH' | 'EXACT_STOP'

export type RuneActivationKind = 'DIRECT_USE' | 'BOARD_MARKER'

export type HeldCardSource = 'DRAW' | 'HONESTY_REWARD'

export type MarkerTtlMode = 'DISPLAYED_IDENTITY_TURN' | 'FULL_TABLE_ROUND'

export interface RuneCardDefinition {
  cardType: RuneCardType
  category: RuneCardCategory
  activationKind: RuneActivationKind
  triggerMode: RuneTriggerMode | null
  markerTTL: 3 | 5 | null
  stepValue: number | null
}

export interface HeldCard {
  heldCardId: string
  ownerPlayerId: string
  cardType: RuneCardType
  /** Starts at 2; removed at start of owner's 3rd normal turn after draw. */
  remainingHandRounds: number
  source: HeldCardSource
}

export interface BoardMarker {
  markerId: string
  cellId: number
  cardType: RuneCardType
  realPlacerId: string
  displayedIdentityId: string
  remainingMarkerRounds: number
  ttlMode: MarkerTtlMode
  createdAtPhaseId: string
}

/** Marker fields visible to all clients (card type stays secret; trigger mode is public). */
export interface PublicBoardMarker {
  markerId: string
  cellId: number
  displayedIdentityId: string
  triggerMode: RuneTriggerMode
}

export interface RunePlayerState {
  drawCount: number
  /** Held cards. Normal draws require length < RUNE_DRAW_HAND_THRESHOLD; honesty rewards may exceed it. */
  hand: HeldCard[]
  /** Revealed draw awaiting player confirmation before joining hand. */
  pendingDraw: HeldCard | null
  /** True while an honesty reward is claimable in this player's current draw & placement phase. */
  hasClaimableHonestyReward: boolean
  /** 0–RUNE_HONESTY_STREAK_FOR_REWARD; stays at max until the reward is claimed next normal turn. */
  honestPlacementStreak: number
}

export interface PlacementPhaseHonestyFlags {
  placedCount: number
  usedImpersonation: boolean
}

export interface PlacementPhaseState {
  phaseId: string
  openedAt: number
  /** Earliest time placement may close when all players are ready (ms). */
  minCloseAt: number
  /** Placement auto-closes at this time (ms). */
  maxCloseAt: number
  honestyByPlayer: Record<string, PlacementPhaseHonestyFlags>
  /** Player id → true when that player confirmed they finished placing. */
  readyByPlayer: Record<string, boolean>
}

export interface RuneGameState {
  markers: BoardMarker[]
  players: Record<string, RunePlayerState>
  placement: PlacementPhaseState | null
}

/** Per-viewer overlay included in client snapshots only. */
export interface RuneClientView {
  myMarkers: Array<{ markerId: string; cardType: RuneCardType }>
  myPendingDraw: HeldCard | null
}

export const RUNE_MAX_DRAW_PER_PLAYER = 25
/**
 * Normal draws are allowed only while holding fewer than this many valid cards.
 * The hand itself has no hard cap: honesty rewards append past this threshold (spec §4.2).
 */
export const RUNE_DRAW_HAND_THRESHOLD = 5
export const RUNE_HELD_CARD_ROUNDS = 2
export const RUNE_HONESTY_STREAK_FOR_REWARD = 5
export const RUNE_PLACEMENT_MIN_MS = 5_000
export const RUNE_PLACEMENT_MAX_MS = 30_000
/** Normal turns the owner cannot select this token after Freeze (tick runs at turn start). */
export const RUNE_FREEZE_TURNS = 3

export const RUNE_ADVANCE_BACK_TYPES: RuneCardType[] = [
  'ADVANCE_2',
  'ADVANCE_3',
  'ADVANCE_4',
  'BACK_3',
  'BACK_4',
  'BACK_5',
]

export const RUNE_OTHER_TYPES: RuneCardType[] = [
  'LEAVE_STABLE',
  'SHIELD',
  'FREEZE',
  'SEND_HOME',
  'SWAP',
]

/** Honesty streak reward pool (spec §4.4). */
export const RUNE_HONESTY_REWARD_TYPES: RuneCardType[] = [
  'LEAVE_STABLE',
  'SHIELD',
  'ADVANCE_2',
  'ADVANCE_3',
  'ADVANCE_4',
]
