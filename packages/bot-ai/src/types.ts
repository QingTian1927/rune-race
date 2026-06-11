import type { BotProfile, GameState } from '@rune-race/shared'

export type Rng = () => number

/** Action the bot wants to execute against the authoritative GameStore. */
export type BotAction =
  | { type: 'roll' }
  | { type: 'choose_move'; moveId: string }
  | { type: 'choose_swap'; targetTokenId: string }
  | { type: 'draw_cards' }
  | { type: 'confirm_draw' }
  | { type: 'finish_draw' }
  | { type: 'place_marker'; heldCardId: string; cellId: number; displayedIdentityId: string }
  | { type: 'confirm_placement_ready' }
  | { type: 'use_leave_stable'; heldCardId: string }

export interface BotDecisionContext {
  state: GameState
  botPlayerId: string
  profile: BotProfile
}

/** Situations a bot may react to in chat. */
export type BotChatTrigger =
  | 'game_start'
  | 'bot_captured_enemy'
  | 'bot_was_captured'
  | 'bot_spawned'
  | 'bot_rolled_six'
  | 'bot_token_finished'
  | 'bot_hit_trap'
  | 'enemy_token_finished'
  | 'bot_won'
  | 'bot_lost'
