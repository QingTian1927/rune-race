/** Deterministic PRNG (mulberry32) for reproducible fake leaderboard jitter. */
export function createRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function randomFloat(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min
}

export function pickOne<T>(rng: () => number, items: readonly T[]): T {
  return items[randomInt(rng, 0, items.length - 1)]!
}
