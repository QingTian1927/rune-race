/** @typedef {import('../types.mjs').PhoneFix} PhoneFix */

const MOBILE_PREFIX = /^0[35789]\d{8}$/
const NINE_DIGIT_MOBILE = /^[35789]\d{8}$/

/**
 * @param {string} digits
 * @param {string} originalRaw
 * @returns {{ phone: string | null, fix: PhoneFix | null, error: string | null }}
 */
function normalizeDigits(digits, originalRaw) {
  if (!digits) {
    return { phone: null, fix: null, error: null }
  }

  let value = digits

  if (value.startsWith('84') && value.length === 11) {
    value = `0${value.slice(2)}`
  }

  if (value.length === 10 && value.startsWith('0') && MOBILE_PREFIX.test(value)) {
    const fix =
      value !== digits
        ? { from: originalRaw, to: value, reason: 'stripped formatting / country code' }
        : null
    return { phone: value, fix, error: null }
  }

  if (value.length === 9 && NINE_DIGIT_MOBILE.test(value)) {
    const phone = `0${value}`
    return {
      phone,
      fix: { from: originalRaw, to: phone, reason: 'prepended leading 0' },
      error: null,
    }
  }

  if (value.length < 9) {
    return { phone: null, fix: null, error: `too few digits (${value.length}): ${originalRaw}` }
  }

  return { phone: null, fix: null, error: `unrecognized phone format: ${originalRaw}` }
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function splitPhoneSegments(raw) {
  const withoutParens = raw.replace(/\([^)]*\)/g, ' ').trim()
  if (!withoutParens) return []

  if (/[/;|]/.test(withoutParens)) {
    return withoutParens
      .split(/[/;|]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  }

  if (/,/.test(withoutParens)) {
    const parts = withoutParens
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    const digitCounts = parts.map((part) => part.replace(/\D/g, '').length)
    if (parts.length > 1 && digitCounts.every((count) => count >= 9)) {
      return parts
    }
  }

  return [withoutParens]
}

/**
 * Normalize messy Vietnamese mobile numbers from spreadsheet cells.
 * Fixes 9-digit numbers missing a leading 0, strips spaces/commas, handles +84,
 * and picks the first valid number when several are listed.
 *
 * @param {string | null | undefined} raw
 * @returns {{ phone: string | null, fix: PhoneFix | null, error: string | null }}
 */
export function normalizeVietnamesePhone(raw) {
  if (raw == null || typeof raw !== 'string') {
    return { phone: null, fix: null, error: null }
  }

  const original = raw.trim()
  if (!original) {
    return { phone: null, fix: null, error: null }
  }

  if (original.includes('@')) {
    return { phone: null, fix: null, error: 'email in phone column' }
  }

  const segments = splitPhoneSegments(original)
  if (segments.length === 0) {
    return { phone: null, fix: null, error: null }
  }

  /** @type {string | null} */
  let lastError = null

  for (const segment of segments) {
    const digits = segment.replace(/\D/g, '')
    const result = normalizeDigits(digits, original)
    if (result.phone) return result
    if (result.error) lastError = result.error
  }

  const wholeDigits = original.replace(/\D/g, '')
  if (wholeDigits && segments.length === 1) {
    const result = normalizeDigits(wholeDigits, original)
    if (result.phone) return result
    if (result.error) lastError = result.error
  }

  return {
    phone: null,
    fix: null,
    error: lastError ?? `invalid phone: ${original}`,
  }
}
