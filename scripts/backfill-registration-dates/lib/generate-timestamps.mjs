/** Vietnam UTC+7 — no DST */
const VN = 'Asia/Ho_Chi_Minh'

/** 29/06/2026 08:00 ICT */
export const RANGE_START_MS = Date.parse('2026-06-29T08:00:00+07:00')
/** 04/07/2026 22:00 ICT */
export const RANGE_END_MS = Date.parse('2026-07-04T22:00:00+07:00')

/** Max signups sharing the exact same VN minute (realistic small bursts). */
const MAX_PER_MINUTE = 2

/** Relative signup volume by day (29/06 → 04/07) */
const DAY_WEIGHTS = [1.45, 1.35, 1.05, 0.95, 0.88, 1.0]

/** Hour-of-day weights (index = hour 0–23 VN) */
const HOUR_WEIGHTS = [
  0.2, 0.15, 0.1, 0.08, 0.12, 0.25, 0.6, 0.9,
  1.4, 1.6, 1.9, 2.0, 1.5, 0.7, 0.85, 0.9,
  0.95, 1.0, 1.15, 1.35, 1.7, 1.55, 0.85, 0.35,
]

/**
 * @param {string} input
 * @returns {number}
 */
function hashString(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * @param {number} seed
 */
function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @param {number[]} weights
 * @param {() => number} rng
 * @returns {number}
 */
function weightedPick(weights, rng) {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = rng() * total
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) return i
  }
  return weights.length - 1
}

/**
 * @param {number} dayOffset
 * @param {number} hour 0–23
 * @param {number} minute 0–59
 * @param {number} second 0–59
 * @returns {number}
 */
function vnDateTimeMs(dayOffset, hour, minute, second) {
  const dayBase = Date.parse('2026-06-29T00:00:00+07:00') + dayOffset * 24 * 60 * 60 * 1000
  const vnDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dayBase))

  return Date.parse(
    `${vnDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+07:00`,
  )
}

/**
 * @param {number} utcMs
 * @returns {{ dayKey: string, minuteKey: string }}
 */
function vnMinuteKeys(utcMs) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs))

  const get = (type) => parts.find((part) => part.type === type)?.value ?? '00'
  const dayKey = `${get('year')}-${get('month')}-${get('day')}`
  const minuteKey = `${dayKey}T${get('hour')}:${get('minute')}`
  return { dayKey, minuteKey }
}

/**
 * @param {number} utcMs
 * @param {() => number} rng
 * @returns {number}
 */
function clampToRange(utcMs, rng) {
  if (utcMs < RANGE_START_MS) {
    return RANGE_START_MS + Math.floor(rng() * 2.5 * 60 * 60 * 1000)
  }
  if (utcMs > RANGE_END_MS) {
    return RANGE_END_MS - Math.floor(rng() * 2 * 60 * 60 * 1000)
  }
  return utcMs
}


/**
 * @param {number} utcMs
 * @returns {string}
 */
export function formatVnDateTime(utcMs) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(utcMs))
}

/**
 * @typedef {Object} TimestampTarget
 * @property {string} email
 * @property {string | null} lastPlayedAt
 */

/**
 * @param {TimestampTarget[]} targets
 * @returns {Map<string, string>}
 */
export function generateRegistrationTimestamps(targets) {
  /** @type {Map<string, string>} */
  const result = new Map()
  /** @type {Set<number>} */
  const used = new Set()
  /** @type {Map<string, number>} */
  const minuteCounts = new Map()

  for (const { email, lastPlayedAt } of targets) {
    const rng = mulberry32(hashString(email.toLowerCase()))

    const dayOffset = weightedPick(DAY_WEIGHTS, rng)
    const hour = weightedPick(HOUR_WEIGHTS, rng)
    const minute = Math.floor(rng() * 60)
    const second = Math.floor(rng() * 60)

    let ts = vnDateTimeMs(dayOffset, hour, minute, second)
    ts = clampToRange(ts, rng)

    if (lastPlayedAt) {
      const lastMs = Date.parse(lastPlayedAt)
      if (!Number.isNaN(lastMs) && ts > lastMs) {
        const minutesBefore = 15 + Math.floor(rng() * 180)
        const extraSeconds = Math.floor(rng() * 60)
        ts = lastMs - minutesBefore * 60 * 1000 - extraSeconds * 1000
        ts = clampToRange(ts, rng)
      }
    }

    ts = placeTimestamp(ts, minuteCounts, used, rng)

    result.set(email.toLowerCase(), new Date(ts).toISOString())
  }

  return result
}

/**
 * @param {number} utcMs
 * @param {Map<string, number>} minuteCounts
 * @param {Set<number>} used
 * @param {() => number} rng
 * @returns {number}
 */
function placeTimestamp(utcMs, minuteCounts, used, rng) {
  let ts = utcMs

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { minuteKey } = vnMinuteKeys(ts)
    const crowded = (minuteCounts.get(minuteKey) ?? 0) >= MAX_PER_MINUTE
    const taken = used.has(ts)

    if (!crowded && !taken) {
      minuteCounts.set(minuteKey, (minuteCounts.get(minuteKey) ?? 0) + 1)
      used.add(ts)
      return ts
    }

    if (crowded) {
      ts += (1 + Math.floor(rng() * 6)) * 60 * 1000
    } else {
      ts += 7 + Math.floor(rng() * 53)
    }
    ts = clampToRange(ts, rng)
  }

  throw new Error('Could not place unique registration timestamp')
}
