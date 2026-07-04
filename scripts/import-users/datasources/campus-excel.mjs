import { readXlsxRows } from '../lib/parse-xlsx-sheet.mjs'
import { normalizeEmail } from '../lib/email-normalize.mjs'
import { dedupeByEmail } from '../lib/dedupe-records.mjs'

/** @typedef {import('../types.mjs').UserImportRecord} UserImportRecord */
/** @typedef {import('../types.mjs').UserDatasource} UserDatasource */

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * @param {string[][]} rows
 */
function detectColumns(rows) {
  const header = rows[0] ?? []
  /** @type {{ name?: number, email?: number, phone?: number, school?: number }} */
  const columns = {}

  header.forEach((cell, index) => {
    const key = normalizeHeader(cell)
    if (!key) return
    if (key.includes('ho va ten') || key.includes('1. ho va ten')) {
      columns.name = index
    }
    if (key.includes('email') || key.includes('3. email')) {
      columns.email = index
    }
    if (key.includes('dien thoai') || key.includes('so dien') || key.includes('phone')) {
      columns.phone = index
    }
    if (key.includes('truong') || key.includes('school')) {
      columns.school = index
    }
  })

  if (columns.name == null || columns.email == null) {
    throw new Error('Could not detect name/email columns in Excel header row')
  }

  return columns
}

function cleanName(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanPhone(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed || null
}

/** @type {UserDatasource} */
export const campusExcelDatasource = {
  id: 'campus-excel',
  label: 'Campus Challenge registration (EXE plan.xlsx)',

  async load({ filePath }) {
    const rows = readXlsxRows(filePath)
    if (rows.length < 2) return []

    const columns = detectColumns(rows)
    /** @type {UserImportRecord[]} */
    const parsed = []

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i]
      const sourceRow = i + 1
      const fullName = cleanName(row[columns.name])
      const emailRaw = String(row[columns.email] ?? '').trim()
      const phone = columns.phone != null ? cleanPhone(row[columns.phone]) : null
      const school = columns.school != null ? cleanName(row[columns.school]) || null : null

      const { email, fix, error } = normalizeEmail(emailRaw)

      parsed.push({
        fullName,
        emailRaw,
        email: email ?? emailRaw.toLowerCase(),
        phone,
        sourceRow,
        extras: {
          school,
          emailError: error,
          emailFix: fix ? JSON.stringify(fix) : null,
        },
      })
    }

    const withIdentity = parsed.filter((record) => record.fullName || record.emailRaw)
    const { unique } = dedupeByEmail(withIdentity)
    return unique
  },
}

/**
 * @param {string} filePath
 * @returns {Promise<number[]>}
 */
export async function loadDuplicateExcelRows(filePath) {
  const rows = readXlsxRows(filePath)
  if (rows.length < 2) return []

  const columns = detectColumns(rows)
  /** @type {UserImportRecord[]} */
  const parsed = []

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i]
    const emailRaw = String(row[columns.email] ?? '').trim()
    const { email } = normalizeEmail(emailRaw)
    parsed.push({
      fullName: cleanName(row[columns.name]),
      emailRaw,
      email: email ?? emailRaw.toLowerCase(),
      phone: null,
      sourceRow: i + 1,
    })
  }

  const { duplicateRows } = dedupeByEmail(parsed.filter((record) => record.emailRaw))
  return duplicateRows
}
