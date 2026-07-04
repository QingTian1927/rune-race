/** @typedef {import('../types.mjs').EmailFix} EmailFix */

const DOMAIN_REPLACEMENTS = [
  [/(@|\.)gmal\.com$/i, '@gmail.com'],
  [/(@|\.)gmial\.com$/i, '@gmail.com'],
  [/(@|\.)gmai\.com$/i, '@gmail.com'],
  [/(@|\.)gnail\.com$/i, '@gmail.com'],
  [/(@|\.)gmail\.con$/i, '@gmail.com'],
  [/(@|\.)gmail\.co$/i, '@gmail.com'],
  [/(@|\.)gmail\.comm$/i, '@gmail.com'],
  [/(@|\.)yahooo\.com$/i, '@yahoo.com'],
  [/(@|\.)yaho\.com$/i, '@yahoo.com'],
  [/(@|\.)hotmial\.com$/i, '@hotmail.com'],
  [/(@|\.)outlok\.com$/i, '@outlook.com'],
]

const LOCAL_TYPO_REPLACEMENTS = [[/^gmal$/, 'gmail']]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * @param {string | null | undefined} raw
 * @returns {{ email: string | null, fix: EmailFix | null, error: string | null }}
 */
export function normalizeEmail(raw) {
  if (raw == null || typeof raw !== 'string') {
    return { email: null, fix: null, error: 'missing email' }
  }

  const original = raw.trim()
  if (!original) {
    return { email: null, fix: null, error: 'empty email' }
  }

  let value = original.toLowerCase().replace(/\s+/g, '')
  const fixes = []

  for (const [pattern, replacement] of LOCAL_TYPO_REPLACEMENTS) {
    const [local, domain] = value.split('@')
    if (!domain) continue
    if (pattern.test(local)) {
      const nextLocal = local.replace(pattern, replacement)
      fixes.push(`local:${local}->${nextLocal}`)
      value = `${nextLocal}@${domain}`
    }
  }

  for (const [pattern, replacement] of DOMAIN_REPLACEMENTS) {
    if (pattern.test(value)) {
      const next = value.replace(pattern, replacement)
      if (next !== value) {
        fixes.push(`domain:${value.split('@')[1]}->${next.split('@')[1]}`)
        value = next
      }
    }
  }

  if (!EMAIL_PATTERN.test(value)) {
    return { email: null, fix: null, error: `invalid email: ${original}` }
  }

  /** @type {EmailFix | null} */
  const fix =
    value !== original.toLowerCase().replace(/\s+/g, '')
      ? { from: original, to: value, reason: fixes.join('; ') || 'normalized' }
      : null

  return { email: value, fix, error: null }
}
