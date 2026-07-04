import { readXlsxRows } from '../lib/parse-xlsx-sheet.mjs'
import { normalizeEmail } from '../lib/email-normalize.mjs'
import { normalizeVietnamesePhone } from '../lib/phone-normalize.mjs'
import { dedupeByEmail } from '../lib/dedupe-records.mjs'

/** @typedef {import('../types.mjs').UserImportRecord} UserImportRecord */
/** @typedef {import('../types.mjs').UserDatasource} UserDatasource */

const NAME_COL = 0
const EMAIL_COL = 1
const PHONE_COL = 2

function cleanName(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * EXE plan 2.xlsx has no header row: column A = full name, B = email, C = phone.
 *
 * @param {string[][]} rows
 * @param {number} [startRowIndex]
 */
function parseRows(rows, startRowIndex = 0) {
  /** @type {UserImportRecord[]} */
  const parsed = []

  for (let i = startRowIndex; i < rows.length; i += 1) {
    const row = rows[i]
    const sourceRow = i + 1
    const fullName = cleanName(row[NAME_COL])
    const emailRaw = String(row[EMAIL_COL] ?? '').trim()
    const phoneRaw = String(row[PHONE_COL] ?? '').trim()

    const { email, fix: emailFix, error: emailError } = normalizeEmail(emailRaw)
    const { phone, fix: phoneFix, error: phoneError } = normalizeVietnamesePhone(phoneRaw)

    parsed.push({
      fullName,
      emailRaw,
      email: email ?? emailRaw.toLowerCase(),
      phone,
      sourceRow,
      extras: {
        phoneRaw: phoneRaw || null,
        emailError,
        emailFix: emailFix ? JSON.stringify(emailFix) : null,
        phoneError,
        phoneFix: phoneFix ? JSON.stringify(phoneFix) : null,
      },
    })
  }

  return parsed
}

/** @type {UserDatasource} */
export const exePlan2ExcelDatasource = {
  id: 'exe-plan2-excel',
  label: 'EXE plan 2 registration (name / email / phone, no header)',

  async load({ filePath }) {
    const rows = readXlsxRows(filePath)
    if (rows.length === 0) return []

    const parsed = parseRows(rows)
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
  if (rows.length === 0) return []

  const parsed = parseRows(rows)
  const { duplicateRows } = dedupeByEmail(parsed.filter((record) => record.emailRaw))
  return duplicateRows
}
