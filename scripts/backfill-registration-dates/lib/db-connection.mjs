/**
 * Parse a Postgres URI even when the password contains @, #, !, etc.
 * Anchors on the hostname tail instead of splitting on the first @.
 *
 * @param {string} url
 * @returns {{ user: string, password: string, host: string, port: number, database: string } | null}
 */
export function parsePostgresUrl(url) {
  const trimmed = url.trim().replace(/^["']|["']$/g, '')
  const prefixMatch = trimmed.match(/^postgres(?:ql)?:\/\//)
  if (!prefixMatch) return null

  const rest = trimmed.slice(prefixMatch[0].length)
  const queryIdx = rest.indexOf('?')
  const pathPart = queryIdx === -1 ? rest : rest.slice(0, queryIdx)

  /** @type {string | null} */
  let hostPart = null

  const supabaseMatch = pathPart.match(
    /@(aws-0-[^/]+\.pooler\.supabase\.com:\d+\/[^/]+|db\.[^/]+\.supabase\.co:\d+\/[^/]+)$/,
  )
  if (supabaseMatch) {
    hostPart = supabaseMatch[0].slice(1)
  } else {
    const genericMatch = pathPart.match(/@([a-zA-Z0-9.-]+:\d+\/[^/]+)$/)
    if (genericMatch) hostPart = genericMatch[1]
  }

  if (!hostPart) return null

  const credsEnd = pathPart.length - hostPart.length - 1
  if (credsEnd < 1 || pathPart[credsEnd] !== '@') return null

  const creds = pathPart.slice(0, credsEnd)
  const colonIdx = creds.indexOf(':')

  if (colonIdx === -1) return null

  const user = creds.slice(0, colonIdx)
  let password = creds.slice(colonIdx + 1)
  try {
    password = decodeURIComponent(password)
  } catch {
    // keep raw password when not percent-encoded
  }

  const parsed = parseHostPart(hostPart)
  return { user, password, ...parsed }
}

/**
 * @param {string} hostPart e.g. host:6543/postgres
 */
function parseHostPart(hostPart) {
  const slashIdx = hostPart.indexOf('/')
  const hostPort = slashIdx === -1 ? hostPart : hostPart.slice(0, slashIdx)
  const database = slashIdx === -1 ? 'postgres' : hostPart.slice(slashIdx + 1).split('?')[0] || 'postgres'

  const colonIdx = hostPort.lastIndexOf(':')
  if (colonIdx === -1) {
    return { host: hostPort, port: 5432, database }
  }

  return {
    host: hostPort.slice(0, colonIdx),
    port: Number(hostPort.slice(colonIdx + 1)) || 5432,
    database,
  }
}

/**
 * @returns {import('pg').PoolConfig | null}
 */
export function resolvePgConfig() {
  const separatePassword = process.env.DATABASE_PASSWORD ?? process.env.PGPASSWORD
  const host = process.env.DATABASE_HOST ?? process.env.PGHOST
  const port = Number(process.env.DATABASE_PORT ?? process.env.PGPORT ?? 6543)
  const user = process.env.DATABASE_USER ?? process.env.PGUSER
  const database = process.env.DATABASE_NAME ?? process.env.PGDATABASE ?? 'postgres'

  if (host && user && separatePassword) {
    return {
      host,
      port,
      user,
      password: separatePassword,
      database,
      ssl: { rejectUnauthorized: false },
      max: 3,
    }
  }

  const url = process.env.DATABASE_URL?.trim()
  if (!url) return null

  const parsed = parsePostgresUrl(url)
  if (parsed) {
    return {
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl: { rejectUnauthorized: false },
      max: 3,
    }
  }

  return null
}

export function pgConfigHelpText() {
  return `Postgres for --apply:
  Paste the full Supabase connection string into DATABASE_URL (password may contain @, #, !, …).
  If the password contains #, wrap the whole value in double quotes in .env.

  DATABASE_URL=postgresql://postgres.ref:your-password@aws-0-....pooler.supabase.com:6543/postgres`
}
