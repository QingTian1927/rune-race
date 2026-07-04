import { readFileSync } from 'node:fs'
import XLSX from 'xlsx'

/**
 * @param {string} filePath
 * @returns {string[][]}
 */
export function readXlsxRows(filePath) {
  const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  /** @type {string[][]} */
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  })

  return rows
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0))
}
