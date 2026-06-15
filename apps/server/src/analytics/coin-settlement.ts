import type { GameState } from '@rune-race/shared'
import { computeCoinSettlement, isCoinEligiblePlayer } from '@rune-race/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureProfileRow } from '../lib/ensure-profile'
import { isUuidLike } from './event-writer'

type CoinSettlementLogger = {
  error: (msg: string, err?: unknown) => void
}

export async function applyCoinSettlement(
  supabase: SupabaseClient,
  gameId: string,
  state: GameState,
  logger: CoinSettlementLogger = { error: () => undefined },
): Promise<void> {
  if (!isUuidLike(gameId) || state.status !== 'finished') return

  const settlement = computeCoinSettlement(state)

  for (const [playerId, breakdown] of Object.entries(settlement)) {
    if (!isUuidLike(playerId) || !isCoinEligiblePlayer(playerId)) continue

    try {
      const { data: existing, error: existingError } = await supabase
        .from('coin_transactions')
        .select('id')
        .eq('player_id', playerId)
        .eq('game_id', gameId)
        .maybeSingle()

      if (existingError) {
        logger.error('coin_transaction_lookup_failed', existingError)
        continue
      }
      if (existing) continue

      if (!(await ensureProfileRow(supabase, playerId))) continue

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('coins')
        .eq('id', playerId)
        .single()

      if (profileError || !profile) {
        logger.error('coin_profile_read_failed', profileError)
        continue
      }

      const currentCoins = typeof profile.coins === 'number' ? profile.coins : 0
      const balanceAfter = Math.max(0, currentCoins + breakdown.total)

      const { error: insertError } = await supabase.from('coin_transactions').insert({
        player_id: playerId,
        game_id: gameId,
        capture_coins: breakdown.capture,
        finish_coins: breakdown.finish,
        total_coins: breakdown.total,
        balance_after: balanceAfter,
      })

      if (insertError) {
        logger.error('coin_transaction_insert_failed', insertError)
        continue
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ coins: balanceAfter })
        .eq('id', playerId)

      if (updateError) {
        logger.error('coin_profile_update_failed', updateError)
      }
    } catch (error) {
      logger.error('coin_settlement_player_failed', error)
    }
  }
}
