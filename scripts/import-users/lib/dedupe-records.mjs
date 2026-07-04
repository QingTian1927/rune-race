/** @typedef {import('../types.mjs').UserImportRecord} UserImportRecord */

/**
 * Keep first row per normalized email; mark duplicates for reporting.
 * @param {UserImportRecord[]} records
 * @returns {{ unique: UserImportRecord[], duplicateRows: number[] }}
 */
export function dedupeByEmail(records) {
  /** @type {UserImportRecord[]} */
  const unique = []
  /** @type {number[]} */
  const duplicateRows = []
  const seen = new Set()

  for (const record of records) {
    const key =
      record.email && !record.extras?.emailError && record.email.includes('@')
        ? record.email
        : `__row__:${record.sourceRow}`
    if (key.startsWith('__row__') === false && seen.has(key)) {
      duplicateRows.push(record.sourceRow)
      continue
    }
    seen.add(key)
    unique.push(record)
  }

  return { unique, duplicateRows }
}
