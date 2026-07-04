import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { applyRegistrationDates } from './lib/apply-dates.mjs'
import { pgConfigHelpText, resolvePgConfig } from './lib/db-connection.mjs'
import {
  formatVnDateTime,
  generateRegistrationTimestamps,
  RANGE_END_MS,
  RANGE_START_MS,
} from './lib/generate-timestamps.mjs'
import { loadMergedExcelUsers, REPO_ROOT } from './lib/load-excel-users.mjs'

const REPORTS_DIR = path.resolve(REPO_ROOT, 'scripts/reports')

function printHelp() {
  console.log(`Usage: pnpm backfill:registration-dates -- [options]

Spread imported users' registration times between 29/06/2026 and 04/07/2026 (VN).

Options:
  --dry-run           Preview new timestamps (no database writes)
  --apply             Update auth.users + profiles.created_at (requires Postgres env)
  --campus-file <p>   Campus Excel (default: EXE plan.xlsx)
  --plan2-file <p>    Plan 2 Excel (default: EXE plan 2.xlsx)

Environment:
  SUPABASE_URL, SUPABASE_SECRET_KEY   list users + profiles (dry-run and apply)

${pgConfigHelpText()}
`)
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i += 1
    }
  }
  return args
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function listAuthUsersByEmail(supabase) {
  /** @type {Map<string, { id: string, createdAt: string | null, email: string }>} */
  const byEmail = new Map()
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)

    for (const user of data.users) {
      const meta = user.user_metadata ?? {}
      if (meta.is_anon === true) continue
      const email = user.email?.trim().toLowerCase()
      if (!email) continue
      byEmail.set(email, {
        id: user.id,
        createdAt: user.created_at ?? null,
        email,
      })
    }

    if (data.users.length < 1000) break
    page += 1
  }

  return byEmail
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} userIds
 */
async function loadProfileLastPlayed(supabase, userIds) {
  /** @type {Map<string, string | null>} */
  const map = new Map()
  const chunkSize = 100

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, last_played_at')
      .in('id', chunk)

    if (error) throw new Error(`profiles select failed: ${error.message}`)

    for (const row of data ?? []) {
      map.set(row.id, row.last_played_at ?? null)
    }
  }

  return map
}

/**
 * @param {unknown[]} rows
 * @param {{ dryRun: boolean }} meta
 */
function writeReport(rows, meta) {
  mkdirSync(REPORTS_DIR, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const suffix = meta.dryRun ? 'dry-run' : 'apply'
  const filePath = path.join(REPORTS_DIR, `registration-dates-backfill-${suffix}-${timestamp}.json`)
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rangeStart: new Date(RANGE_START_MS).toISOString(),
        rangeEnd: new Date(RANGE_END_MS).toISOString(),
        dryRun: meta.dryRun,
        rows,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  return filePath
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const dryRun = Boolean(args['dry-run'])
  const apply = Boolean(args.apply)
  if (dryRun === apply) {
    console.error('Specify exactly one of --dry-run or --apply')
    printHelp()
    process.exitCode = 1
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
  const pgConfig = resolvePgConfig()

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment (.env)')
    process.exitCode = 1
    return
  }

  if (apply && !pgConfig) {
    console.error('Missing Postgres connection for --apply.\n')
    console.error(pgConfigHelpText())
    process.exitCode = 1
    return
  }

  const campusFile = path.resolve(REPO_ROOT, String(args['campus-file'] ?? 'EXE plan.xlsx'))
  const plan2File = path.resolve(REPO_ROOT, String(args['plan2-file'] ?? 'EXE plan 2.xlsx'))

  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`)
  console.log(`Range: ${formatVnDateTime(RANGE_START_MS)} → ${formatVnDateTime(RANGE_END_MS)} (VN)`)
  console.log(`Campus file: ${campusFile}`)
  console.log(`Plan 2 file: ${plan2File}`)

  const excelUsers = await loadMergedExcelUsers({ campusFile, plan2File })
  console.log(`Excel targets: ${excelUsers.length} unique emails`)

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const authByEmail = await listAuthUsersByEmail(supabase)

  /** @type {{ email: string, lastPlayedAt: string | null }[]} */
  const timestampTargets = []
  /** @type {string[]} */
  const missingInAuth = []

  for (const record of excelUsers) {
    const email = record.email.toLowerCase()
    const authUser = authByEmail.get(email)
    if (!authUser) {
      missingInAuth.push(email)
      continue
    }
    timestampTargets.push({ email, lastPlayedAt: null })
  }

  const userIds = timestampTargets
    .map((target) => authByEmail.get(target.email)?.id)
    .filter(Boolean)
  const lastPlayedById = await loadProfileLastPlayed(supabase, userIds)

  for (const target of timestampTargets) {
    const authUser = authByEmail.get(target.email)
    if (!authUser) continue
    target.lastPlayedAt = lastPlayedById.get(authUser.id) ?? null
  }

  const timestamps = generateRegistrationTimestamps(timestampTargets)

  /** @type {Array<Record<string, unknown>>} */
  const reportRows = []
  /** @type {{ userId: string, createdAt: string }[]} */
  const updates = []

  for (const record of excelUsers) {
    const email = record.email.toLowerCase()
    const authUser = authByEmail.get(email)
    const newCreatedAt = timestamps.get(email)
    if (!authUser || !newCreatedAt) continue

    reportRows.push({
      email,
      fullName: record.fullName,
      userId: authUser.id,
      oldCreatedAt: authUser.createdAt,
      oldCreatedAtVn: authUser.createdAt ? formatVnDateTime(Date.parse(authUser.createdAt)) : null,
      newCreatedAt,
      newCreatedAtVn: formatVnDateTime(Date.parse(newCreatedAt)),
      lastPlayedAt: lastPlayedById.get(authUser.id) ?? null,
    })

    updates.push({ userId: authUser.id, createdAt: newCreatedAt })
  }

  reportRows.sort(
    (a, b) => Date.parse(String(a.newCreatedAt)) - Date.parse(String(b.newCreatedAt)),
  )

  console.log(`\nWill update: ${updates.length} users`)
  if (missingInAuth.length > 0) {
    console.log(`Not in auth (skipped): ${missingInAuth.length}`)
    for (const email of missingInAuth.slice(0, 5)) {
      console.log(`  - ${email}`)
    }
    if (missingInAuth.length > 5) {
      console.log(`  ... and ${missingInAuth.length - 5} more`)
    }
  }

  console.log('\nSample (first 8 by new date):')
  for (const row of reportRows.slice(0, 8)) {
    console.log(
      `  ${row.newCreatedAtVn}  ${row.email}  (was ${row.oldCreatedAtVn ?? '—'})`,
    )
  }
  if (reportRows.length > 8) {
    console.log(`  ... ${reportRows.length - 8} more in report`)
  }

  if (apply) {
    console.log('\nApplying updates via Postgres...')
    await applyRegistrationDates(pgConfig, updates)
    console.log(`Done — updated ${updates.length} users.`)
  } else {
    console.log('\nDry-run only — no database changes.')
  }

  const reportPath = writeReport(reportRows, { dryRun })
  console.log(`Report: ${reportPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
