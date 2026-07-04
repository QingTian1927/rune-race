import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { campusExcelDatasource } from '../../import-users/datasources/campus-excel.mjs'
import { exePlan2ExcelDatasource } from '../../import-users/datasources/exe-plan2-excel.mjs'

/** @typedef {import('../../import-users/types.mjs').UserImportRecord} UserImportRecord */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(__dirname, '../../..')

/**
 * Merge campus + plan2 spreadsheets; first occurrence wins per email.
 *
 * @param {{ campusFile: string, plan2File: string }} options
 * @returns {Promise<UserImportRecord[]>}
 */
export async function loadMergedExcelUsers({ campusFile, plan2File }) {
  /** @type {UserImportRecord[]} */
  const merged = []
  const seen = new Set()

  const sources = [
    { filePath: campusFile, label: 'campus-excel' },
    { filePath: plan2File, label: 'exe-plan2-excel' },
  ]

  for (const source of sources) {
    const records = await (source.label === 'campus-excel'
      ? campusExcelDatasource
      : exePlan2ExcelDatasource
    ).load({ filePath: source.filePath })

    for (const record of records) {
      if (record.extras?.emailError) continue
      if (!record.email?.includes('@')) continue

      const key = record.email.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(record)
    }
  }

  return merged
}
