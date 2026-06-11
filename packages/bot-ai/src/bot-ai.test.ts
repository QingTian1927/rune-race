import { describe, expect, it } from 'vitest'
import { randomBotName } from './names.js'
import { pickBotProfile } from './profile.js'
import { pickChatMessage, shouldChatOnTrigger, decorateChatMessage } from './chat/templates.js'

describe('randomBotName', () => {
  it('avoids names already taken in the lobby', () => {
    const taken = ['Bé Na', 'Lucky Dice']
    for (let i = 0; i < 50; i += 1) {
      const name = randomBotName(taken)
      expect(taken).not.toContain(name)
      expect(name.length).toBeGreaterThan(0)
    }
  })

  it('falls back to a suffixed name when the pool is exhausted', () => {
    const taken: string[] = []
    for (let i = 0; i < 60; i += 1) {
      taken.push(randomBotName(taken))
    }
    expect(new Set(taken).size).toBe(taken.length)
  })
})

describe('pickBotProfile', () => {
  it('returns simple or complex based on rng', () => {
    expect(pickBotProfile(() => 0.1)).toBe('complex')
    expect(pickBotProfile(() => 0.9)).toBe('simple')
  })
})

describe('chat templates', () => {
  it('always returns a non-empty message for every trigger and profile', () => {
    const triggers = [
      'game_start',
      'bot_captured_enemy',
      'bot_was_captured',
      'bot_spawned',
      'bot_rolled_six',
      'bot_token_finished',
      'bot_hit_trap',
      'enemy_token_finished',
      'bot_won',
      'bot_lost',
    ] as const
    for (const trigger of triggers) {
      for (const profile of ['simple', 'complex'] as const) {
        expect(pickChatMessage(trigger, profile).length).toBeGreaterThan(0)
      }
    }
  })

  it('gates chat by probability', () => {
    expect(shouldChatOnTrigger('bot_won', 'complex', () => 0.01)).toBe(true)
    expect(shouldChatOnTrigger('bot_rolled_six', 'simple', () => 0.99)).toBe(false)
  })

  it('decorates messages with VN emoticons when rng allows', () => {
    // rng sequence: pick pool index 0, decorate yes (0.1), emoticon branch, placement suffix...
    let i = 0
    const seq = [0, 0.1, 0.1, 0.1, 0.1, 0.1]
    const rng = () => seq[i++ % seq.length]!
    const msg = decorateChatMessage('test tin nhắn', 'bot_won', 'simple', rng)
    expect(msg).toMatch(/test tin nhắn/)
    expect(msg.length).toBeGreaterThan('test tin nhắn'.length)
  })

  it('skips decoration when rng is above threshold', () => {
    const msg = decorateChatMessage('giữ nguyên', 'game_start', 'simple', () => 0.99)
    expect(msg).toBe('giữ nguyên')
  })

  it('strips old trailing emoticon before adding new one', () => {
    const msg = decorateChatMessage('cay quá :v', 'bot_was_captured', 'simple', () => 0.1)
    expect(msg).not.toMatch(/:v\s+:v/)
  })
})
