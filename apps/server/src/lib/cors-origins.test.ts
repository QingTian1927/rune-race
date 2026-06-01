import { afterEach, describe, expect, it } from 'vitest'
import { resolveCorsOrigins } from './cors-origins'

describe('resolveCorsOrigins', () => {
  const env = process.env

  afterEach(() => {
    process.env = env
  })

  it('merges CLIENT_ORIGIN and ADMIN_ORIGIN', () => {
    process.env = {
      ...env,
      CLIENT_ORIGIN: 'https://game.example.com',
      ADMIN_ORIGIN: 'https://admin.example.com/',
    }
    expect(resolveCorsOrigins()).toEqual([
      'https://game.example.com',
      'https://admin.example.com',
    ])
  })

  it('returns true when no origins configured', () => {
    process.env = { ...env, CLIENT_ORIGIN: '', ADMIN_ORIGIN: '' }
    expect(resolveCorsOrigins()).toBe(true)
  })
})
