import { config } from 'dotenv'
import path from 'node:path'

/** Load repo-root `.env` (see `.env.example`) when running from `apps/server`. */
const repoRoot = path.resolve(__dirname, '../../..')
config({ path: path.join(repoRoot, '.env') })
