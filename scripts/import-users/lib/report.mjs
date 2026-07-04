import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {import('../types.mjs').ImportRowResult} ImportRowResult */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPORTS_DIR = path.resolve(__dirname, '../../reports')

/**
 * @param {ImportRowResult[]} results
 * @param {{ datasourceId: string, dryRun: boolean, duplicateRows: number[] }} meta
 */
export function writeImportReport(results, meta) {
  mkdirSync(REPORTS_DIR, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const suffix = meta.dryRun ? 'dry-run' : 'apply'
  const fileName = `user-import-${meta.datasourceId}-${suffix}-${timestamp}.json`
  const filePath = path.join(REPORTS_DIR, fileName)

  const summary = results.reduce(
    (acc, row) => {
      acc[row.action] = (acc[row.action] ?? 0) + 1
      return acc
    },
    /** @type {Record<string, number>} */ ({}),
  )

  const payload = {
    generatedAt: new Date().toISOString(),
    datasourceId: meta.datasourceId,
    dryRun: meta.dryRun,
    summary,
    duplicateExcelRows: meta.duplicateRows,
    rows: results,
  }

  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return filePath
}

/**
 * @param {ImportRowResult[]} results
 * @param {{ duplicateRows: number[] }} meta
 */
export function printImportSummary(results, meta) {
  const counts = results.reduce(
    (acc, row) => {
      acc[row.action] = (acc[row.action] ?? 0) + 1
      return acc
    },
    /** @type {Record<string, number>} */ ({}),
  )

  console.log('\nImport summary')
  console.log('----------------')
  for (const [key, value] of Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`${key}: ${value}`)
  }
  if (meta.duplicateRows.length > 0) {
    console.log(`skipped_duplicate_row (excel): ${meta.duplicateRows.length}`)
    console.log(`  rows: ${meta.duplicateRows.join(', ')}`)
  }

  const errors = results.filter((row) => row.action === 'error' || row.action === 'skipped_invalid')
  if (errors.length > 0) {
    console.log('\nIssues')
    for (const row of errors) {
      console.log(`  row ${row.sourceRow} ${row.email}: ${row.message}`)
    }
  }
}
