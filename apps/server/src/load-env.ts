import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Load repo-root `.env` (see `.env.example`) when running from `apps/server`. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
config({ path: path.join(repoRoot, '.env') })
