import { describe, expect, it } from 'vitest'
import {
  shouldDeferSentHomeUntilMoverLands,
  type MoveAnimationPayload,
  type SentHomeEventDetails,
} from './tokenMotion'

describe('shouldDeferSentHomeUntilMoverLands', () => {
  const sentHome: SentHomeEventDetails = {
    tokenId: 't1',
    status: 'sent_home',
    from: { state: 'on_track', position: 6 },
    to: { state: 'in_base', position: 0 },
  }

  it('defers when trap cell is a teleport waypoint in the move path', () => {
    const move: MoveAnimationPayload = {
      timestamp: 1,
      details: {
        tokenId: 't1',
        path: [
          { state: 'on_track', position: 4, motion: 'step' },
          { state: 'on_track', position: 6, motion: 'teleport' },
        ],
        from: { state: 'on_track', position: 3 },
        to: { state: 'in_base', position: 0 },
      },
    }
    expect(shouldDeferSentHomeUntilMoverLands(move, sentHome)).toBe(true)
  })

  it('defers when trap cell is a regular step in the move path', () => {
    const move: MoveAnimationPayload = {
      timestamp: 1,
      details: {
        tokenId: 't1',
        path: [{ state: 'on_track', position: 6, motion: 'step' }],
        from: { state: 'on_track', position: 5 },
        to: { state: 'in_base', position: 0 },
      },
    }
    expect(shouldDeferSentHomeUntilMoverLands(move, sentHome)).toBe(true)
  })

  it('does not defer when sent-home has no matching path step', () => {
    const move: MoveAnimationPayload = {
      timestamp: 1,
      details: {
        tokenId: 't1',
        path: [{ state: 'on_track', position: 4, motion: 'step' }],
        from: { state: 'on_track', position: 3 },
        to: { state: 'in_base', position: 0 },
      },
    }
    expect(shouldDeferSentHomeUntilMoverLands(move, sentHome)).toBe(false)
  })
})
