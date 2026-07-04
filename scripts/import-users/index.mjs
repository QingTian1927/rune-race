import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { campusExcelDatasource, loadDuplicateExcelRows as campusDuplicateRows } from './datasources/campus-excel.mjs'
import {
  exePlan2ExcelDatasource,
  loadDuplicateExcelRows as exePlan2DuplicateRows,
} from './datasources/exe-plan2-excel.mjs'
import { createSupabaseImporter } from './lib/supabase-user-import.mjs'
import { printImportSummary, writeImportReport } from './lib/report.mjs'

/** @typedef {import('./types.mjs').UserDatasource} UserDatasource */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

/** @type {Record<string, UserDatasource>} */
const DATASOURCES = {
  [campusExcelDatasource.id]: campusExcelDatasource,
  [exePlan2ExcelDatasource.id]: exePlan2ExcelDatasource,
}

/** @type {Record<string, (filePath: string) => Promise<number[]>>} */
const DUPLICATE_ROW_LOADERS = {
  [campusExcelDatasource.id]: campusDuplicateRows,
  [exePlan2ExcelDatasource.id]: exePlan2DuplicateRows,
}

const DEFAULT_PASSWORD = '123456'

function printHelp() {
  console.log(`Usage: pnpm import:users -- [options]

Options:
  --datasource <id>   Data source plugin (default: campus-excel)
  --file <path>       Input file path (default: EXE plan.xlsx at repo root)
  --dry-run           Preview actions without writing to Supabase
  --apply             Execute create/update against Supabase (required to write)
  --password <value>  Default password for newly created users (default: 123456)

Available datasources:
${Object.values(DATASOURCES)
  .map((source) => `  - ${source.id}: ${source.label}`)
  .join('\n')}
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

  const datasourceId = String(args.datasource ?? 'campus-excel')
  const datasource = DATASOURCES[datasourceId]
  if (!datasource) {
    console.error(`Unknown datasource: ${datasourceId}`)
    printHelp()
    process.exitCode = 1
    return
  }

  const filePath = path.resolve(REPO_ROOT, String(args.file ?? 'EXE plan.xlsx'))
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
  const defaultPassword = String(args.password ?? DEFAULT_PASSWORD)

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment (.env)')
    process.exitCode = 1
    return
  }

  console.log(`Datasource: ${datasource.label}`)
  console.log(`File: ${filePath}`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`)

  const records = await datasource.load({ filePath })
  const loadDuplicateRows = DUPLICATE_ROW_LOADERS[datasourceId]
  const duplicateRows = loadDuplicateRows ? await loadDuplicateRows(filePath) : []

  console.log(`Loaded ${records.length} unique records`)

  const importer = createSupabaseImporter({
    supabaseUrl,
    supabaseSecretKey,
    defaultPassword,
  })

  /** @type {import('./types.mjs').ImportRowResult[]} */
  const results = []
  for (const record of records) {
    results.push(await importer.importRecord(record, { dryRun }))
  }

  for (const sourceRow of duplicateRows) {
    results.push({
      action: 'skipped_duplicate_row',
      sourceRow,
      email: '',
      fullName: null,
      userId: null,
      message: 'duplicate email in spreadsheet; kept first row only',
      emailFix: null,
    })
  }

  const reportPath = writeImportReport(results, {
    datasourceId,
    dryRun,
    duplicateRows,
  })

  printImportSummary(results, { duplicateRows })
  console.log(`\nReport: ${reportPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
